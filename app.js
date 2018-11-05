const os = require('os')
const pmx = require('pmx')
const pm2 = require('pm2')
const {
  InfluxDB,
  FieldType,
} = require('influx')

pmx.initModule({}, (err, conf) => {
  if(err) {
    console.error('Error starting module!')
    console.error(err)
    process.exit(-1)
  }

  //console.log('Starting with ', conf)
  console.log(`Influx ${conf.dbname}@${conf.dbhost}`)
  const influx = new InfluxDB({
    host: conf.dbhost,
    database: conf.dbname,
    schema: [
      {
        measurement: 'pm2_apps',
        fields: {
          memory: FieldType.INTEGER,
          cpu: FieldType.FLOAT,
        },
        tags: [
          'hostname',
          'repo',
          'stage',
          'node',
          'name',
          'instance',
        ],
      }
    ]
  })

  function record() {
    pm2.list((err, apps) => {
      if(err) {
        return console.error(err)
      }
      
      let data = apps.map(app => {
        return {
          measurement: 'pm2_apps',
          fields: {
            memory: app.monit.memory / (1024 * 1024),
            cpu: app.monit.cpu,
          },
          tags: {
            hostname: os.hostname(),
            repo: conf.repo,
            node: process.version.replace('v', ''),
            name: app.name,
            stage: process.env.STAGE || process.env.SITE_ID,
            instance: app.pm2_env['NODE_APP_INSTANCE'],
          },
        }
      })
      influx
        .writePoints(data)
        .then(() => console.log('done'))
        .catch(e => {
          console.error(`failed!`)
          console.error(e)
        })
    })
  }
  
  pm2.connect(err => {
    if(err) {
      console.error('Could not connect to PM2')
      console.error(err)
      process.exit(-1)
    }

    setInterval(record, conf.interval * 1000) 
  })
})
