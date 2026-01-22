# Golf Muerte Lenta

App web para registrar jugadas, apuestas y pagos entre jugadores.

## Setup rapido

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Semillas de campos

```bash
node scripts/seedCourses.js
```

## Stack

- Next.js (App Router) + React
- MongoDB + Mongoose
- Socket.IO para tarjetas en vivo

## Changelog

### 0.1.2

- Sesion permanente (token y cookie de larga duracion).
- Registro de tarjeta precarga datos guardados y muestra aviso de carga.
- Nueva jugada: descripcion opcional y fecha de creacion visible en tablero.

### 0.1.1

- Registro solicita handicap; aprobacion genera contraseña aleatoria y se envia en el mensaje de bienvenida.
- Tarjetas: se quitan valores predeterminados y no se guardan ceros sin captura.
- Castigos/eventos: Wet vuelve a captura y se muestra con "W"; Cuatriputt y Nerdina se calculan automatico; nuevo castigo manual "Whiskeys".
- Navegacion: boton "Cerrar sesion" en el encabezado.
- Dashboard: en "Jugadas abiertas" se listan jugadores por nombre.

## Cloud config para generar server

#cloud-config
users:
  - name: hector
    ssh-authorized-keys:
      - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMC4pFZJfS6W31ShfFoCplh3V0LB0RhRK6FDGnszkXR3 hector@HectorMBP.local
    sudo: ['ALL=(ALL) NOPASSWD:ALL']
    shell: /bin/bash
packages:
  - man
  - rdiff
  - rsync
  - wget
  - gnupg
  - mlocate
  - curl
  - htop
  - colordiff
  - net-tools
  - python3-pip
  - apache2
  - ufw
  - nodejs
runcmd:
  - sed -i -e '/^PermitRootLogin/s/^.*$/PermitRootLogin no/' /etc/ssh/sshd_config
  - sed -i -e '$aAllowUsers hector' /etc/ssh/sshd_config
  - restart ssh
  - ufw allow OpenSSH
  - ufw enable
  - curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  - echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
  - apt-get update
  - apt-get install -y nodejs
  - curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
  - echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/8.0 main" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
  - apt-get update
  - apt-get install -y mongodb-org
  - a2enmod headers
  - a2enmod rewrite
  - a2enmod ssl
  - a2enmod proxy
  - a2enmod http_proxy
  - echo 'ServerName Powered_by_OpcionGUIK' >> /etc/apache2/apache2.conf
  - usermod -a -G www-data hector
