/**
 * dataMock.js — APIs institucionales SIMULADAS para la prueba técnica "Portal de Roles".
 *
 * Todo lo que hay aquí es ficticio: personas, contraseñas, credenciales y respuestas.
 * No necesitas instalar nada: solo Node.js 18 o superior.
 *
 *   node dataMock.js                                → http://localhost:4000
 *   PORT=5000 node dataMock.js                      → otro puerto
 *   TOKEN_VIGENCIA_SEGUNDOS=20 node dataMock.js     → tokens que vencen antes (para probar la renovación)
 *
 * Este archivo hace las veces de los sistemas de la universidad. Tu BACKEND lo consume por HTTP,
 * como consumiría las APIs reales. El FRONTEND nunca debe llamarlo ni importar este archivo:
 * por eso no envía encabezados CORS (el navegador bloquea las llamadas directas).
 *
 * Léelo completo, pero no lo modifiques: la prueba se califica con esta versión.
 *
 * Rutas
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *   GET  /salud                   Estado del servicio (sirve para el healthcheck).
 *   POST /sso/login               Inicio de sesión institucional (usuario y contraseña).
 *   POST /oauth/token             Token de acceso (OAuth2 client_credentials).
 *   GET  /roles                   Catálogo de roles institucionales.            [token]
 *   GET  /roles/{username}        Roles institucionales de una persona.         [token]
 *   GET  /personas?buscar=texto   Directorio institucional (uso opcional).      [token]
 *   GET  /ia/preguntas            Preguntas que entiende la IA simulada.        [X-API-Key]
 *   POST /ia/chat                 Respuesta de la IA simulada.                  [X-API-Key]
 *
 *   [token]     → encabezado  Authorization: Bearer <access_token de /oauth/token>
 *   [X-API-Key] → encabezado  X-API-Key: <IA_API_KEY>
 *
 * Formato de las respuestas
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *   Éxito:  { "codigo": "200", "resultado": [ ... ] }
 *   Error:  { "codigo": "401", "descripcion": "Motivo del error.", "resultado": [] }
 *
 *   OJO: "codigo" es texto, no número. Y no siempre coincide con el estado HTTP: por ejemplo,
 *   GET /roles/{username} de una persona que no existe responde HTTP 200 con "codigo": "404".
 *   Revisa siempre "codigo", no solo el estado HTTP.
 *
 *   La única excepción es POST /oauth/token, que responde como Keycloak (formato OAuth2 estándar):
 *   Éxito:  { "access_token": "...", "token_type": "Bearer", "expires_in": 300 }
 *   Error:  { "error": "invalid_client", "error_description": "Motivo del error." }
 */

"use strict";

const http = require("node:http");
const crypto = require("node:crypto");

// ═════════════════════════════════════════════════════════════════════════════════════════
// 1. Configuración y credenciales (FICTICIAS)
//    En tu backend, estos valores van en el archivo .env, nunca escritos en el código.
// ═════════════════════════════════════════════════════════════════════════════════════════

const PUERTO = Number(process.env.PORT) || 4000;

const CLIENTE_OAUTH = {
  client_id: "portal-roles",
  client_secret: "secreto-de-prueba",
};

const TOKEN_VIGENCIA_SEGUNDOS = Number(process.env.TOKEN_VIGENCIA_SEGUNDOS) || 300; // 5 minutos

const IA_API_KEY = "clave-ia-de-prueba";

const IA_DEMORA_MS = 600; // la IA simulada "piensa" un poco antes de responder

// ═════════════════════════════════════════════════════════════════════════════════════════
// 2. Personas (lo que conoce el inicio de sesión institucional y el directorio)
//    Todas tienen la misma contraseña de prueba.
// ═════════════════════════════════════════════════════════════════════════════════════════

const CONTRASENA_DE_PRUEBA = "Prueba2026*";

const PERSONAS = [
  { username: "admin.prueba",      nombre: "Andrea Gómez",    correo: "admin.prueba@ejemplo.edu.co",      dependencia: "Dirección de Tecnología" },
  { username: "ana.estudiante",    nombre: "Ana Martínez",    correo: "ana.estudiante@ejemplo.edu.co",    dependencia: "Programa de Ingeniería de Sistemas" },
  { username: "carlos.profesor",   nombre: "Carlos Rodríguez", correo: "carlos.profesor@ejemplo.edu.co",  dependencia: "Departamento de Matemáticas" },
  { username: "diana.catedratica", nombre: "Diana Herrera",   correo: "diana.catedratica@ejemplo.edu.co", dependencia: "Departamento de Física" },
  { username: "pedro.funcionario", nombre: "Pedro Castillo",  correo: "pedro.funcionario@ejemplo.edu.co", dependencia: "Oficina de Admisiones" },
  { username: "laura.egresada",    nombre: "Laura Jiménez",   correo: "laura.egresada@ejemplo.edu.co",    dependencia: "Egresada de Psicología" },
  { username: "mario.mayusculas",  nombre: "Mario Pacheco",   correo: "mario.mayusculas@ejemplo.edu.co",  dependencia: "Egresado de Derecho" },
  { username: "sofia.sinrol",      nombre: "Sofía Rincón",    correo: "sofia.sinrol@ejemplo.edu.co",      dependencia: "Sin vinculación vigente" },
  { username: "luis.externo",      nombre: "Luis Barrios",    correo: "luis.externo@ejemplo.edu.co",      dependencia: "Proveedor externo" },
  { username: "jorge.contratista", nombre: "Jorge Molina",    correo: "jorge.contratista@ejemplo.edu.co", dependencia: "Contratista de Infraestructura" },
  { username: "usuario.error",     nombre: "Valentina Ortiz", correo: "usuario.error@ejemplo.edu.co",     dependencia: "Oficina de Planeación" },
].map((persona) => ({ ...persona, password: CONTRASENA_DE_PRUEBA }));

// ═════════════════════════════════════════════════════════════════════════════════════════
// 3. Roles institucionales
// ═════════════════════════════════════════════════════════════════════════════════════════

// Lo que responde GET /roles (catálogo completo).
const CATALOGO_ROLES = ["ESTUDIANTES", "FUNCIONARIOS", "PROFESORES", "CATEDRÁTICOS", "EGRESADOS"];

// Lo que responde GET /roles/{username}, tal como lo entrega el sistema institucional:
// no siempre viene con las mismas mayúsculas, tildes o espacios.
const ROLES_POR_USUARIO = {
  "admin.prueba":      ["FUNCIONARIOS"],
  "ana.estudiante":    ["ESTUDIANTES"],
  "carlos.profesor":   ["PROFESORES", "CATEDRÁTICOS"],
  "diana.catedratica": ["Catedraticos"],
  "pedro.funcionario": ["EGRESADOS", "FUNCIONARIOS"],
  "laura.egresada":    ["EGRESADOS"],
  "mario.mayusculas":  ["  egresados "],
  "sofia.sinrol":      [],
  "jorge.contratista": ["CONTRATISTAS"],
  // "luis.externo" no está en el sistema de roles → HTTP 200 con "codigo": "404".
  // "usuario.error" hace fallar el servicio        → HTTP 500 con "codigo": "500".
};

const USUARIOS_QUE_HACEN_FALLAR_EL_SERVICIO = ["usuario.error"];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 4. IA simulada
//    Solo responde si la pregunta coincide EXACTAMENTE con una de esta lista (mayúsculas,
//    tildes y signos incluidos; solo se ignoran los espacios al inicio y al final).
//    Si no coincide, no responde nada: "resultado" llega vacío.
//
//    Las respuestas traen variables entre llaves, como {nombre} o {roles}. La IA no conoce
//    tus datos: tu backend debe reemplazar cada variable con el dato real antes de mostrarla.
//
//    "perfil" dice quién puede recibir la respuesta: TODOS o solo ADMINISTRADOR.
//    La IA simulada no revisa el perfil: eso le toca a tu backend.
// ═════════════════════════════════════════════════════════════════════════════════════════

const PREGUNTAS_IA = [
  {
    id: "mis-roles",
    perfil: "TODOS",
    pregunta: "¿Qué roles tengo?",
    respuesta: "Hola, {nombre}. Tus roles son: {roles}.",
  },
  {
    id: "mi-perfil",
    perfil: "TODOS",
    pregunta: "¿Cuál es mi perfil?",
    respuesta: "Tu perfil en el Portal de Roles es {perfil}.",
  },
  {
    id: "roles-con-acceso",
    perfil: "TODOS",
    pregunta: "¿Qué roles dan acceso al portal?",
    respuesta: "Dan acceso los roles activos del catálogo, excepto EGRESADOS. Hoy son: {roles_con_acceso}.",
  },
  {
    id: "egresados",
    perfil: "TODOS",
    pregunta: "¿Pueden entrar los egresados?",
    respuesta:
      "No. El rol EGRESADOS no da acceso al portal. Si una persona tiene además otro rol que sí da acceso, entra por ese rol.",
  },
  {
    id: "pedir-admin",
    perfil: "TODOS",
    pregunta: "¿Cómo pido acceso de administrador?",
    respuesta:
      "Solo un administrador puede cambiar tu perfil. Tu perfil actual es {perfil}. Escríbele a quien administra el portal.",
  },
  {
    id: "total-usuarios",
    perfil: "ADMINISTRADOR",
    pregunta: "¿Cuántos usuarios hay registrados?",
    respuesta: "Hay {total_usuarios} usuarios registrados en el portal.",
  },
  {
    id: "total-administradores",
    perfil: "ADMINISTRADOR",
    pregunta: "¿Cuántos administradores hay?",
    respuesta: "Hay {total_administradores} administradores en el portal.",
  },
  {
    id: "asignar-rol",
    perfil: "ADMINISTRADOR",
    pregunta: "¿Cómo le asigno un rol a un usuario?",
    respuesta:
      "Ve a Usuarios, pulsa Editar en la persona y marca los roles que quieres sumarle. Esos roles se suman a los que entrega el sistema institucional.",
  },
];

// ═════════════════════════════════════════════════════════════════════════════════════════
// 5. Servidor (no necesitas cambiar nada de aquí en adelante)
// ═════════════════════════════════════════════════════════════════════════════════════════

const tokensVigentes = new Map(); // access_token → momento en que vence (ms)

const exito = (resultado) => ({ codigo: "200", resultado });
const falla = (codigo, descripcion) => ({ codigo: String(codigo), descripcion, resultado: [] });

function responder(res, estadoHttp, cuerpo) {
  const json = JSON.stringify(cuerpo);
  res.writeHead(estadoHttp, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let texto = "";
    req.setEncoding("utf8");
    req.on("data", (pedazo) => {
      texto += pedazo;
      if (texto.length > 100_000) {
        reject(new Error("Cuerpo demasiado grande"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(texto));
    req.on("error", reject);
  });
}

function tipoDeContenido(req) {
  return (req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
}

async function leerJson(req) {
  if (tipoDeContenido(req) !== "application/json") return null;
  try {
    const datos = JSON.parse(await leerCuerpo(req));
    return datos && typeof datos === "object" ? datos : null;
  } catch {
    return null;
  }
}

function tokenValido(req) {
  const [esquema, token] = (req.headers.authorization || "").split(" ");
  if (esquema !== "Bearer" || !token) return false;
  const vence = tokensVigentes.get(token);
  if (!vence) return false;
  if (vence <= Date.now()) {
    tokensVigentes.delete(token);
    return false;
  }
  return true;
}

function sinTildes(texto) {
  return String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Rutas ─────────────────────────────────────────────────────────────────────────────────

async function salud(req, res) {
  responder(res, 200, exito([{ servicio: "dataMock", estado: "ok" }]));
}

async function ssoLogin(req, res) {
  const datos = await leerJson(req);
  if (!datos || typeof datos.username !== "string" || typeof datos.password !== "string") {
    return responder(
      res,
      400,
      falla(400, 'Envía un JSON con "username" y "password" (Content-Type: application/json).'),
    );
  }
  const persona = PERSONAS.find((p) => p.username === datos.username.trim().toLowerCase());
  if (!persona || persona.password !== datos.password) {
    return responder(res, 401, falla(401, "Usuario o contraseña incorrectos."));
  }
  const { username, nombre, correo } = persona;
  responder(res, 200, exito([{ username, nombre, correo }]));
}

async function oauthToken(req, res) {
  if (tipoDeContenido(req) !== "application/x-www-form-urlencoded") {
    return responder(res, 400, {
      error: "invalid_request",
      error_description: "El cuerpo debe ir como application/x-www-form-urlencoded.",
    });
  }
  const datos = new URLSearchParams(await leerCuerpo(req));
  if (datos.get("grant_type") !== "client_credentials") {
    return responder(res, 400, {
      error: "unsupported_grant_type",
      error_description: 'Solo se admite grant_type "client_credentials".',
    });
  }
  if (
    datos.get("client_id") !== CLIENTE_OAUTH.client_id ||
    datos.get("client_secret") !== CLIENTE_OAUTH.client_secret
  ) {
    return responder(res, 401, {
      error: "invalid_client",
      error_description: "Credenciales de cliente inválidas.",
    });
  }
  const accessToken = crypto.randomBytes(24).toString("hex");
  tokensVigentes.set(accessToken, Date.now() + TOKEN_VIGENCIA_SEGUNDOS * 1000);
  responder(res, 200, {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: TOKEN_VIGENCIA_SEGUNDOS,
  });
}

async function catalogoRoles(req, res) {
  if (!tokenValido(req)) return responder(res, 401, falla(401, "Token inválido o vencido."));
  responder(res, 200, exito([{ roles: CATALOGO_ROLES }]));
}

async function rolesDeUsuario(req, res, username) {
  if (!tokenValido(req)) return responder(res, 401, falla(401, "Token inválido o vencido."));
  const usuario = username.trim().toLowerCase();
  if (USUARIOS_QUE_HACEN_FALLAR_EL_SERVICIO.includes(usuario)) {
    return responder(res, 500, falla(500, "Error interno del servicio de roles."));
  }
  if (!Object.hasOwn(ROLES_POR_USUARIO, usuario)) {
    return responder(res, 200, falla(404, "Usuario no encontrado en el sistema de roles."));
  }
  responder(res, 200, exito([{ roles: ROLES_POR_USUARIO[usuario] }]));
}

async function directorio(req, res, url) {
  if (!tokenValido(req)) return responder(res, 401, falla(401, "Token inválido o vencido."));
  const buscar = sinTildes(url.searchParams.get("buscar") || "");
  if (buscar.length < 2) {
    return responder(res, 400, falla(400, 'El parámetro "buscar" debe tener al menos 2 caracteres.'));
  }
  const encontradas = PERSONAS.filter(
    (p) => sinTildes(p.username).includes(buscar) || sinTildes(p.nombre).includes(buscar),
  )
    .slice(0, 10)
    .map(({ username, nombre, correo, dependencia }) => ({ username, nombre, correo, dependencia }));
  responder(res, 200, exito(encontradas));
}

function claveIaValida(req) {
  return req.headers["x-api-key"] === IA_API_KEY;
}

async function preguntasIa(req, res) {
  if (!claveIaValida(req)) return responder(res, 401, falla(401, "X-API-Key inválida o ausente."));
  responder(res, 200, exito(PREGUNTAS_IA.map(({ id, pregunta, perfil }) => ({ id, pregunta, perfil }))));
}

async function chatIa(req, res) {
  if (!claveIaValida(req)) return responder(res, 401, falla(401, "X-API-Key inválida o ausente."));
  const datos = await leerJson(req);
  if (!datos || typeof datos.pregunta !== "string") {
    return responder(
      res,
      400,
      falla(400, 'Envía un JSON con "pregunta" (Content-Type: application/json).'),
    );
  }
  await esperar(IA_DEMORA_MS);
  const encontrada = PREGUNTAS_IA.find((p) => p.pregunta === datos.pregunta.trim());
  if (!encontrada) return responder(res, 200, exito([])); // no coincide: la IA no responde nada
  const { id, respuesta, perfil } = encontrada;
  const variables = [...respuesta.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  responder(res, 200, exito([{ id, respuesta, perfil, variables }]));
}

// ── Enrutador ─────────────────────────────────────────────────────────────────────────────

const RUTAS = [
  { metodo: "GET", patron: /^\/salud$/, manejar: salud },
  { metodo: "POST", patron: /^\/sso\/login$/, manejar: ssoLogin },
  { metodo: "POST", patron: /^\/oauth\/token$/, manejar: oauthToken },
  { metodo: "GET", patron: /^\/roles$/, manejar: catalogoRoles },
  { metodo: "GET", patron: /^\/roles\/([^/]+)$/, manejar: (req, res, url, m) => rolesDeUsuario(req, res, decodeURIComponent(m[1])) },
  { metodo: "GET", patron: /^\/personas$/, manejar: (req, res, url) => directorio(req, res, url) },
  { metodo: "GET", patron: /^\/ia\/preguntas$/, manejar: preguntasIa },
  { metodo: "POST", patron: /^\/ia\/chat$/, manejar: chatIa },
];

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const ruta = url.pathname.replace(/\/+$/, "") || "/";
  res.on("finish", () => {
    // Solo método, ruta y estado: nunca cuerpos, contraseñas ni tokens.
    console.log(`[dataMock] ${req.method} ${ruta} → ${res.statusCode}`);
  });

  const coincidencias = RUTAS.map((r) => ({ ...r, m: ruta.match(r.patron) })).filter((r) => r.m);
  if (coincidencias.length === 0) {
    return responder(res, 404, falla(404, `No existe la ruta ${ruta}.`));
  }
  const destino = coincidencias.find((r) => r.metodo === req.method);
  if (!destino) {
    return responder(res, 405, falla(405, `Método ${req.method} no permitido en ${ruta}.`));
  }
  try {
    await destino.manejar(req, res, url, destino.m);
  } catch (error) {
    console.error(`[dataMock] Error inesperado en ${ruta}: ${error.message}`);
    if (!res.headersSent) responder(res, 500, falla(500, "Error inesperado en el servicio simulado."));
  }
});

servidor.listen(PUERTO, "0.0.0.0", () => {
  console.log(`[dataMock] APIs simuladas listas en http://localhost:${PUERTO}`);
  console.log(`[dataMock] Los tokens vencen a los ${TOKEN_VIGENCIA_SEGUNDOS} segundos.`);
});

// Se detiene limpio con Ctrl+C o cuando Podman para el contenedor.
for (const senal of ["SIGINT", "SIGTERM"]) {
  process.on(senal, () => {
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
