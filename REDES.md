# Preguntas de redes

## 1. DNS para `portal-roles.ejemplo.edu.co`

Un registro A con valor de la dirección IPv4 del servidor. Si el servidor tiene IPv6, deberíamos poner un
registro AAAA con la IPv6 del servidor. Si lo hacemos detrás de un nombre existente, deberíamos poner un
CNAME que apunte a ese nombre en vez de una IP. Para comprobar que resuelve se usa nslookup en Windows y
Linux o dig en Linux y macOS.

```bash
nslookup portal-roles.ejemplo.edu.co
dig portal-roles.ejemplo.edu.co
```

Si devuelve la IP esperada, ya resuelve. Si no, hay que esperar a que se propague o el registro está mal.

## 2. Puertos publicados y puertos internos

Cada contenedor es como una casa con sus puertas, que son los puertos. Publicar un puerto con
`-p 8080:8080` es abrir esa puerta hacia tu computador y la red, y cualquiera que llegue a tu equipo puede
entrar por ahí. Si no se publica, la puerta solo existe dentro de la red interna de Podman, que se llama
`portal-red`, y solo los otros contenedores la pueden usar.

En el portal el único puerto publicado es el 8080 del frontend con nginx, que es por donde se entra con
`localhost:8080`. El backend con FastAPI en el 8000, dataMock en el 4000 y la base de datos PostgreSQL en
el 5432 no están publicados y solo existen dentro de `portal-red`. Se puede ver con `podman ps`, donde solo
el frontend muestra `0.0.0.0:8080->8080/tcp`.

El 5432 de la base de datos no se publica porque si queda abierto cualquiera puede conectarse directo a
PostgreSQL, intentar adivinar la contraseña y llegar a los datos saltándose todas las reglas del portal.
El backend tampoco, porque la única entrada debe ser nginx, que es donde están los encabezados de
seguridad, el límite de intentos del login y el HTTPS. Con el backend abierto alguien podría entrar por la
puerta de atrás. En general, mientras menos puertas abiertas haya menos superficie de ataque, y cada
servicio solo lo alcanza quien lo necesita.

## 3. ¿Por qué `localhost:5432` no llega a la base de datos desde el backend?

Porque cada contenedor tiene su propia red, y dentro del backend localhost es el mismo contenedor del
backend, donde no hay ningún PostgreSQL escuchando. Usé el host `db`, que es el nombre del contenedor de la
base de datos. Funciona porque todos los contenedores están en la misma red de Podman, que se llama
`portal-red`, y esa red tiene un DNS interno que traduce el nombre de cada contenedor a su IP. Lo mismo
pasa con `datamock` y con nginx, que le pasa las peticiones al backend por su nombre.

```
DATABASE_URL=postgresql+asyncpg://portal:...@db:5432/portal
```

## 4. Puertos por defecto de HTTP y HTTPS y el balanceador con el 3005

El puerto por defecto de HTTP es el 80 y el de HTTPS es el 443. Si el balanceador recibe a los usuarios y
le pasa el tráfico al servidor por HTTP en el 3005, en el firewall del servidor solo abriría el 3005 por TCP
y solo para la IP del balanceador, no para todo internet. Así los usuarios siempre pasan por el balanceador
y nadie puede llegar directo al servidor. El 443 se abre en el balanceador, no en el servidor.

Por ejemplo con firewalld, si el balanceador tiene la IP 10.0.0.10

```bash
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="10.0.0.10/32" port port="3005" protocol="tcp" accept'
firewall-cmd --reload
```

## 5. Podman rootless y el puerto 80

En Linux los puertos por debajo del 1024 son privilegiados y solo root puede abrirlos. Podman rootless
corre los contenedores con mi usuario normal y no como root, por eso no puede publicar el 80. Lo que haría
es publicar en un puerto alto como el 8080, que es lo que hace este portal, y poner delante un proxy o
balanceador que reciba el 80 y el 443 y le pase el tráfico al 8080. Otra opción es redirigir el 80 al 8080
en el firewall, o bajar el límite de puertos privilegiados del sistema, pero eso afecta a todos los usuarios
del servidor y lo usaría con cuidado. Por eso el frontend usa la imagen nginx-unprivileged, que escucha en
el 8080 y no necesita root.

## 6. Ver los puertos que escuchan en un servidor Linux

Usaría `sudo ss -tulpn`, que muestra los puertos TCP y UDP que están escuchando, con el número del puerto y
el programa que lo tiene abierto. El sudo es para ver también los procesos de otros usuarios.
