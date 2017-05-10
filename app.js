'use strict'

const async = require('async')
const axios = require('axios')

const HypercatDataConverter = require('./misc/hypercat-data-converter')

let config = {
  endpoint: 'http://localhost:9090/cat',
  key: 'passkey',

  map: JSON.stringify({
    'urn:X-reekoh:rels:hasId': 'id',
    'urn:X-reekoh:rels:hasName:en': 'name',
    'urn:X-hypercat:rels:hasDescription:en': 'description',
    'urn:X-reekoh:rels:timestamp': 'timestamp'
  })
}

let axconf = null
let converter = null

const DEBUG = false
const SHELL_COUNT = 100

var handleErr = (err) => {
	if (err && DEBUG) console.log(err)
}

let __addDevice = device => {
	if (!converter) return handleErr(new Error('Converter not initialized'))

	if (DEBUG) console.log('[Raw Data: add]', device)

	converter.toItemData(device, (err, itemData) => {
	if (err) return handleErr(err)

	if (DEBUG) console.log('[Converted Data: add]', itemData)

	async.waterfall([
    (done) => { // check if exist
      axios.get(itemData.href).then(resp => {
        done(null, !!resp.data.items.length)
      }).catch(done)
    },
    (exist, done) => {
	    if (exist) { // update
        console.log(`Add device '${device._id}' - already exist in Hypercat. PUT triggered.`);
        axios.put(`${config.endpoint}?href=${itemData.href}`, itemData, axconf).then(() => {
          done()
        }).catch(done)
      } else { // insert
        axios.post(config.endpoint, itemData, axconf).then(() => {
          console.log(`Added device '${device._id}' in Hypercat`)
          done()
        }).catch(done)
      }
    }
  ], err => {
    if (err) return handleErr(err)
  })
})
}

let __updateDevice = device => {
	if (!converter) return handleErr(new Error('Converter not initialized'))

  if (DEBUG) console.log('[Raw Data: upd]', device)

	converter.toItemData(device, (err, itemData) => {
		if (err) return handleErr(err)

    if (DEBUG) onsole.log('[Converted Data: upd]', itemData)

		if (!itemData.href) return handleErr(new Error(`'href' property is missing`))

		axios.put(`${config.endpoint}?href=${itemData.href}`, itemData, axconf).then(resp => {
			console.log(`Updated device '${device._id}'`)
		}).catch(err => {
			handleErr(err)
		})
	})
}

let __deleteDevice = device => {
	if (!converter) return handleErr(new Error('Converter not initialized'))

  if (DEBUG) console.log('[Raw Data: rmv]', device)

	if (!device._id)
	  return handleErr(new Error(`Field '_id' is not specified in removedevice request. data: ${JSON.stringify(device)}`))

  if (!device.metadata) device.metadata = {}

	if (!device.metadata.href) {
    device.metadata.href = `${config.endpoint}?val=${device._id}`
  }

	axios.delete(`${config.endpoint}?href=${device.metadata.href}`, axconf).then(resp => {
		process.send({
			done: true,
			method: 'removedevice'
		});
	}).catch(handleErr)
}

let b2Bomber = () => {
	async.parallel([
		done => {
			for (var i = 0; i < SHELL_COUNT; i++) {
				__addDevice({
					_id: `DEVICE-${i}`,
					name: `Test Device ${i}`,
					metadata: {
						href: `${config.endpoint}?val=DEVICE-${i}`,
						description: `This is a test device - DEVICE-${i}`
					}
				})
			}
			done()
		},
		done => {
			for (var i = 0; i < SHELL_COUNT; i++) {
				__addDevice({
					_id: `DEVICE-${i}`,
					name: `Test Device ${i}`,
					metadata: {
						href: `${config.endpoint}?val=DEVICE-${i}`,
						description: `This is a test device - DEVICE-${i}`
					}
				})
			}
			done()
		}
	], err => {
		if (err) handleErr(err)
	})
}

async.series([
	done => {
		axios.get(config.endpoint).then(resp => {
			async.waterfall([
				async.constant(config.map),
				async.asyncify(JSON.parse)
			], (err, map) => {
				if (err) return handleErr(err)

				converter = new HypercatDataConverter(map, config.endpoint);
				axconf = {headers: {'x-api-key': config.key}};

				console.log('Hypercat Bomber has been initialized.');
				done()
			})
		}).catch(handleErr)
	},
	done => {
		b2Bomber()
	}
], err => {
	if (err) return console.log(err)
	console.log('Done!')
})