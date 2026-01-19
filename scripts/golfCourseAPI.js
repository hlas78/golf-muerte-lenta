const axios = require('axios')
const fs = require('fs')
const apiKey = 'MKHAIO3ZMX4UDT2QBDFWYGZ3OY'
const headers = {
  Authorization: `Key ${apiKey}`
}
const url = 'https://api.golfcourseapi.com/v1'

const search = (searchParams) => {
  return new Promise((resolve, reject)=>{
    axios.get(`${url}/search?search_query=${searchParams}`, { headers }).then(res=>{
      resolve(res.data)
    }).catch(err=>{
      console.error(err.response.data)
    })
  })
}

search('el bosque country club').then(res=>{
  // console.log(res.courses[0])
  fs.writeFileSync(`./campos/${res.courses[0].id}.json`, JSON.stringify(res.courses[0],null,1))
})
