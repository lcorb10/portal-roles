from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db import DbDep
from app.deps import AdminDep, ContextoDep, solo_admin
from app.espacios import (
    DIAS_ADELANTE,
    HORA_APERTURA,
    HORA_CIERRE,
    MAX_HORAS,
    MAX_RESERVAS_FUTURAS,
    hoy,
    motivo_no_puede,
    roles_que_habilitan,
    validar_reserva,
)
from app.models import Espacio, EstadoReserva, Reserva, Rol
from app.schemas import (
    Aviso,
    CancelarIn,
    DisponibilidadOut,
    EspacioEditar,
    EspacioOut,
    FranjaOcupada,
    ReglasReserva,
    ReservaCrear,
    ReservaOut,
)
from app.servicios import auditar

router = APIRouter(prefix="/api", tags=["espacios"])
admin = APIRouter(prefix="/api/admin", tags=["espacios"], dependencies=[Depends(solo_admin)])

Id = Annotated[int, Path(ge=1)]


def espacio_out(espacio: Espacio, contexto: ContextoDep) -> EspacioOut:
    habilitan = roles_que_habilitan(espacio, contexto.evaluacion)
    motivo = motivo_no_puede(espacio, habilitan)
    return EspacioOut(
        id=espacio.id,
        codigo=espacio.codigo,
        nombre=espacio.nombre,
        tipo=espacio.tipo,
        ubicacion=espacio.ubicacion,
        capacidad=espacio.capacidad,
        descripcion=espacio.descripcion,
        activo=espacio.activo,
        roles_permitidos=[r.codigo for r in espacio.roles],
        rol_ids=[r.id for r in espacio.roles],
        puede_reservar=motivo is None,
        motivo=motivo,
        habilitado_por=habilitan,
    )


def reserva_out(r: Reserva) -> ReservaOut:
    return ReservaOut(
        id=r.id,
        espacio_id=r.espacio_id,
        espacio=r.espacio.nombre,
        espacio_codigo=r.espacio.codigo,
        ubicacion=r.espacio.ubicacion,
        usuario=r.usuario.usuario,
        nombre_usuario=r.usuario.nombre,
        fecha=r.fecha,
        hora_inicio=r.hora_inicio,
        hora_fin=r.hora_fin,
        motivo=r.motivo,
        asistentes=r.asistentes,
        estado=EstadoReserva(r.estado),
        creada_en=r.creada_en,
        cancelada_por=r.cancelada_por,
        cancelada_por_otro=r.cancelada_por is not None and r.cancelada_por != r.usuario.usuario,
        motivo_cancelacion=r.motivo_cancelacion,
    )


async def buscar_espacio(db: DbDep, espacio_id: int) -> Espacio:
    espacio = await db.get(Espacio, espacio_id)
    if espacio is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="El espacio no existe.")
    return espacio


@router.get("/espacios/reglas")
async def reglas() -> ReglasReserva:
    return ReglasReserva(
        hora_apertura=HORA_APERTURA,
        hora_cierre=HORA_CIERRE,
        max_horas=MAX_HORAS,
        dias_adelante=DIAS_ADELANTE,
        max_reservas=MAX_RESERVAS_FUTURAS,
        hoy=hoy(),
    )


@router.get("/espacios")
async def listar_espacios(contexto: ContextoDep, db: DbDep) -> list[EspacioOut]:
    espacios = (await db.scalars(select(Espacio).order_by(Espacio.id))).all()
    return [espacio_out(e, contexto) for e in espacios]


@router.get("/espacios/{espacio_id}/disponibilidad")
async def disponibilidad(
    espacio_id: Id, fecha: Annotated[date, Query()], contexto: ContextoDep, db: DbDep
) -> DisponibilidadOut:
    espacio = await buscar_espacio(db, espacio_id)
    reservas = (
        await db.scalars(
            select(Reserva)
            .where(
                Reserva.espacio_id == espacio.id,
                Reserva.fecha == fecha,
                Reserva.estado == EstadoReserva.ACTIVA,
            )
            .order_by(Reserva.hora_inicio)
        )
    ).all()
    return DisponibilidadOut(
        fecha=fecha,
        ocupadas=[
            FranjaOcupada(
                hora_inicio=r.hora_inicio,
                hora_fin=r.hora_fin,
                propia=r.usuario_id == contexto.usuario.id,
                # Solo un administrador o el dueño ven quién reservó.
                por=r.usuario.nombre if contexto.es_admin or r.usuario_id == contexto.usuario.id else None,
            )
            for r in reservas
        ],
    )


@router.post("/reservas", status_code=status.HTTP_201_CREATED)
async def reservar(datos: ReservaCrear, contexto: ContextoDep, db: DbDep) -> ReservaOut:
    espacio = await buscar_espacio(db, datos.espacio_id)
    motivo = motivo_no_puede(espacio, roles_que_habilitan(espacio, contexto.evaluacion))
    if motivo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=motivo)
    problema = await validar_reserva(
        db, espacio, contexto.usuario.id, datos.fecha, datos.hora_inicio, datos.hora_fin, datos.asistentes
    )
    if problema:
        raise HTTPException(status.HTTP_409_CONFLICT, detail=problema)
    reserva = Reserva(
        espacio_id=espacio.id,
        usuario_id=contexto.usuario.id,
        fecha=datos.fecha,
        hora_inicio=datos.hora_inicio,
        hora_fin=datos.hora_fin,
        motivo=datos.motivo,
        asistentes=datos.asistentes,
    )
    db.add(reserva)
    auditar(
        db,
        contexto.usuario.usuario,
        "RESERVA_CREADA",
        f"Reservó {espacio.nombre} el {datos.fecha:%d/%m} de {datos.hora_inicio}:00 a {datos.hora_fin}:00.",
    )
    await db.commit()
    await db.refresh(reserva)
    return reserva_out(reserva)


@router.get("/reservas/mias")
async def mis_reservas(contexto: ContextoDep, db: DbDep) -> list[ReservaOut]:
    reservas = await db.scalars(
        select(Reserva)
        .where(Reserva.usuario_id == contexto.usuario.id)
        .order_by(Reserva.fecha.desc(), Reserva.hora_inicio.desc())
        .limit(50)
    )
    return [reserva_out(r) for r in reservas]


@router.post("/reservas/{reserva_id}/cancelar", status_code=status.HTTP_204_NO_CONTENT)
async def cancelar(reserva_id: Id, datos: CancelarIn, contexto: ContextoDep, db: DbDep) -> Response:
    reserva = await db.get(Reserva, reserva_id)
    if reserva is None or (reserva.usuario_id != contexto.usuario.id and not contexto.es_admin):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="La reserva no existe.")
    if reserva.estado != EstadoReserva.ACTIVA:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="La reserva ya estaba cancelada.")
    ajena = reserva.usuario_id != contexto.usuario.id
    if ajena and (not datos.motivo or len(datos.motivo) < 5):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Escribe el motivo de la cancelación (mínimo 5 caracteres): la persona lo verá.",
        )
    reserva.estado = EstadoReserva.CANCELADA
    reserva.cancelada_por = contexto.usuario.usuario
    reserva.motivo_cancelacion = datos.motivo or None
    reserva.aviso_pendiente = ajena
    detalle = f"Canceló la reserva de {reserva.espacio.nombre} del {reserva.fecha:%d/%m}"
    if ajena:
        detalle += f" (era de {reserva.usuario.usuario}). Motivo: {datos.motivo}"
    auditar(db, contexto.usuario.usuario, "RESERVA_CANCELADA", detalle + ".")
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Avisos para la persona ────────────────────────────────────────────────────────────


@router.get("/avisos")
async def avisos(contexto: ContextoDep, db: DbDep) -> list[Aviso]:
    """Reservas de la persona que canceló un administrador y que aún no ha visto."""
    reservas = await db.scalars(
        select(Reserva)
        .where(Reserva.usuario_id == contexto.usuario.id, Reserva.aviso_pendiente)
        .order_by(Reserva.id.desc())
    )
    return [
        Aviso(
            id=r.id,
            titulo="Cancelaron tu reserva",
            detalle=f"{r.espacio.nombre}, {r.fecha:%d/%m} de {r.hora_inicio}:00 a {r.hora_fin}:00.",
            motivo=r.motivo_cancelacion,
            por=r.cancelada_por,
            espacio_codigo=r.espacio.codigo,
            fecha=r.creada_en,
        )
        for r in reservas
    ]


@router.post("/avisos/leidos", status_code=status.HTTP_204_NO_CONTENT)
async def marcar_leidos(contexto: ContextoDep, db: DbDep) -> Response:
    reservas = await db.scalars(
        select(Reserva).where(Reserva.usuario_id == contexto.usuario.id, Reserva.aviso_pendiente)
    )
    for r in reservas:
        r.aviso_pendiente = False
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Administración ──────────────────────────────────────────────────────────────────────


@admin.get("/reservas")
async def todas_las_reservas(
    db: DbDep,
    desde: Annotated[date | None, Query()] = None,
    espacio_id: Annotated[int | None, Query(ge=1)] = None,
) -> list[ReservaOut]:
    consulta = select(Reserva).where(Reserva.fecha >= (desde or hoy()))
    if espacio_id:
        consulta = consulta.where(Reserva.espacio_id == espacio_id)
    reservas = await db.scalars(consulta.order_by(Reserva.fecha, Reserva.hora_inicio).limit(200))
    return [reserva_out(r) for r in reservas]


@admin.put("/espacios/{espacio_id}")
async def editar_espacio(espacio_id: Id, datos: EspacioEditar, db: DbDep, contexto: AdminDep) -> EspacioOut:
    espacio = await buscar_espacio(db, espacio_id)
    cambios: list[str] = []
    if datos.activo is not None and datos.activo != espacio.activo:
        espacio.activo = datos.activo
        cambios.append("habilitado" if datos.activo else "deshabilitado")
    if datos.capacidad is not None and datos.capacidad != espacio.capacidad:
        espacio.capacidad = datos.capacidad
        cambios.append(f"capacidad={datos.capacidad}")
    if datos.rol_ids is not None:
        ids = sorted(set(datos.rol_ids))
        roles = list((await db.scalars(select(Rol).where(Rol.id.in_(ids)))).all()) if ids else []
        if len(roles) != len(ids):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Alguno de los roles no existe."
            )
        espacio.roles = roles
        cambios.append(f"roles={', '.join(r.codigo for r in roles) or 'ninguno'}")
    if cambios:
        auditar(
            db, contexto.usuario.usuario, "ESPACIO_EDITADO", f"Editó {espacio.nombre}: {'; '.join(cambios)}."
        )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail="No se pudo guardar el espacio.") from None
    await db.refresh(espacio)
    return espacio_out(espacio, contexto)
