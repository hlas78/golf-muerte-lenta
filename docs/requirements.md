Quiero construir una aplicación web que se llamará "Golf Muerte Lenta" para un grupo de golfistas, esta aplicación (llena de diversión) ayudará principalmente a registrar jugadas y calcular apuestas entre los jugadores. Esta aplicación tendrá diferentes pantallas para cumplir con este objetivo.

La aplicación debe estar desarrollada en NodeJS, y con resguardo de datos en MongoDB, y será consultada principalmente a través de navegadores en teléfonos celulares por lo que el diseño visual debe estar enfocado a estos dispositivos, utiliza algun framework visual atractivo, te comparto también el logo del grupo.

Roles de usuarios:
 - Jugador
 - Supervisor
 - Administrador

La base de datos tendrá precargada una colección de campos, con documentos similares a la estructura del archivo campos/15444.json

Las pantallas que debe tener la aplicación son:

- Ingreso con usuario y contraseña
- Altas bajas y cambios de usuarios, sus handicaps y sus roles
- Los supervisores / administradores pueden abrir una nueva jugada seleccionando el campo, y los demás jugadores pueden unirse a jugadas abiertas
- Los administradores tienen acceso a la configuración de la aplicación, en parámetros como monto de cada item de apuesta
- Registrar jugadas
 - Cada jugador debe registrar su propia jugada
 - Un supervisor en cada grupo debe aceptar los registros de los jugadores al final de las rondas, que pueden ser de 9 o 18 hoyos
 - Para registrar cada jugada hay que seleccionar un campo
-Resumir la jugada en tarjetas de puntuación que será visible para todos los usuarios en tiempo real
- Los items que generan ganadores en cada ronda son:
 - Ganador de cada hoyo, si hay empates se elimina
 - Ganador de medal
 - Ganador de match
 - Sandy par
 - Birdie
 - Aguila
 - Albatross
 - Hole out
 - Wet par
- Hay items que generan castigos que también deben registrarse (y comunicarse sarcásticamente), no generan pagos de dinero pero deben aparecer en los scorecards:
 - Pinkies
 - Cuatriputt
 - Saltapatrás
 - Paloma
 - Nerdiña (10 or more at any hole) 
- Calcular los pagos a ganadores y cobros a perdedores tomando en cuenta los handicaps

En la base de datos se debe mantener resguardado el histórico de jugadas así como los pagos entre jugadores


Agrega un botón a la pantalla de login, que permita al usuario registrarse, solicitándole su número telefónico para enviarle una liga de autenticación por whatsapp (agregué como ejemplo la función sendMessage en el script sendMessage.js), una vez que el usuario ingrese a la liga, quedará en estatus de pendiente, hasta que un administrador lo acepte en la aplicación, posterior a ello el usuario podrá autenticarse todas las veces que quiera utilizando la misma liga, o solicitando una nueva a través del proceso de registro.