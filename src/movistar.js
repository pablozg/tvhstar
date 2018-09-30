//
//  LuisPa 2017/01/05
//
//  Controlador que trata con el servidor de Movistar Plus
//
'use strict';

// Imports
import rp from 'request-promise';
import fs from 'fs';

// Mis imports
import Utils from './utils';

// Controlador
const movistar = {

	// Send an API Rest Query to the remote pacoapp-db-mongo to
	// create all the items that I've passed.
	//
	requestEPG: function (progPreferences) {
		// Aseguremos...
		if (!progPreferences || !progPreferences.urlMovistar ||
		!progPreferences.cadenasHOME || !progPreferences.diasInicioFin) {
			console.error('ERROR INTERNO GRAVE!! Movistar.requestEPG necesita argumentos.')
			process.exit();
		}

		// Creo el array con los id's
		let arrayCadenas = [];
		progPreferences.cadenasHOME.map(cadena => {
			if (cadena.movistar_epg) {
				arrayCadenas.push(cadena.movistar_id)
			}
			if (cadena.tvh_m3u){
				progPreferences.generaM3U = true;
			}
		});
		

		// Preparo la petición
		let options = {
			method: 'POST',
			uri: progPreferences.urlMovistar,
			formData: {
				'action': 'export_programation',
				'export-date-from': progPreferences.diasInicioFin.fechaInicio,
				'export-date-to': progPreferences.diasInicioFin.fechaFin,
				'export-gender': '',
				'export-format': 'xml',
				'export-filters': '',
				'categoriesExport[]': arrayCadenas.toString(),
				'channelsExport[]': arrayCadenas
				
			},
			headers: {
				/*'origin': 'http://comunicacion.movistarplus.es',
				'connection': 'keep-alive',
				'cache-control': 'max-age=0',
				'upgrade-insecure-requests': '1',
				'content-type': 'application/x-www-form-urlencoded',
				'user-agent': 'Mozilla/5.0 (Windows NT10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36',
				'referer': 'http://comunicacion.movistarplus.es/programacion/'*/
			},
			resolveWithFullResponse: true
		}
		

		// Realizamos la petición
	  console.log(`  => Se solicita el EPG para ${arrayCadenas.length} canales ${arrayCadenas}`)
		return new Promise((resolve, reject) => {
			rp(options)
			.then((response) => {
				console.log(`  => OK, se ha recibido el EPG correctamente`);
				resolve(response);
			})
			.catch((err) => {
				reject(err);
			});
		});
	},

}

export default movistar;
