const axios = require("axios");

async function sendMessage(to, message) {
  if (to.startsWith('00'))
    return
  console.log(`sendMessage ${to}: ${message}`);
  const auth = {
    username: "apiAlertasog",
    password: "fjosadij320p",
  };

  return new Promise((resolve, reject) => {
    const data = {
      token: "alertas_opcionguik",
      to: `521${to}`,
      message,
    };
    axios
      .post("https://wa.opcionguik.com.mx/api/send/message", data, { auth })
      .then((res) => {
        console.log(res.data);
        resolve("sent");
      })
      .catch((err) => {
        console.error(err);
        reject(`error ${err}`);
      });
  });
}

if (require.main === module) {
  sendMessage(process.argv[2], process.argv[3]);
}

module.exports = { sendMessage };
