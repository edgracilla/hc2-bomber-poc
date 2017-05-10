'use strict'

const async = require('async')

class HypercatDataConverter {
	constructor(map, endpointUrl) {
		this.endpointUrl = endpointUrl
    this.map = map
	}

	toCatJSON(cat, callback) {
		let data = {}
		let items = []
		let catMeta = []
		let map = this.map

		async.series([
			(done) => {
				async.each(cat['catalogue-metadata'], (entry, cb) => {
					if (map[entry.rel]) catMeta[map[entry.rel]] = entry.val
					cb()
				}, done)
			},
			(done) => {
				async.each(cat.items, (item, cb) => {
					let oItem = {
						href: item.href
					}

					async.each(item['item-metadata'], (prop, cb2) => {
						if (map[prop.rel]) oItem[map[prop.rel]] = prop.val
						cb2()
					}, (err) => {
						if (!err) items.push(oItem)
						cb()
					})
				}, done)
			}
		], (err) => {
			callback(err, {
				catMeta: catMeta,
				items: items
			})
		})
	}

	toItemData(device, callback) {
		let itemData = {}
		let metadata = []
		let map = this.map
		let rel = ''

		let getRel = (value) => {
			for (var prop in map) {
				if (map.hasOwnProperty(prop) && value === map[prop]) {
					return prop
				}
			}

			return false
		}

		if (!device._id) return callback(new Error(`Invalid Device Info. '_id' not found. Device: ${JSON.stringify(device)}`))
		if (!device.name) return callback(new Error(`Invalid Device Info. 'name' not found. Device: ${JSON.stringify(device)}`))

		if (device.metadata && device.metadata.href) {
			itemData.href = device.metadata.href
			delete device.metadata.href
		} else {
      itemData.href = `${this.endpointUrl}?val=${device._id}`
    }

		rel = getRel('_id') || getRel('id')
		metadata.push({
			rel: rel,
			val: device._id
		})

		rel = getRel('name')
		metadata.push({
			rel: rel,
			val: device.name
		})

		// description is required in hypercat
		if (device.metadata && device.metadata.description) {
			metadata.push({
				rel: 'urn:X-hypercat:rels:hasDescription:en',
				val: device.metadata.description
			})
		} else {
			metadata.push({
				rel: 'urn:X-hypercat:rels:hasDescription:en',
				val: `${device.name} - synced with Reekoh`
			})
		}

		if (device.metadata) {
			delete device.metadata.description
		}

		for (var prop in device.metadata) {
			if (device.metadata.hasOwnProperty(prop)) { // silly but yea its the saviour
				rel = getRel(prop)

				if (rel && device.metadata[prop]) {
					metadata.push({
						rel: rel,
						val: device.metadata[prop]
					})
				}
			}
		}

		itemData['item-metadata'] = metadata
		callback(null, itemData)
	}
}

module.exports = HypercatDataConverter