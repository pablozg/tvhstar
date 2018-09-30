//
// LuisPa 2017/01/05
//
'use strict';

// Imports
import fs from 'fs';
import xml2js from 'xml2js'; // https://github.com/Leonidas-from-XIV/node-xml2js

// Herramientas varias
const utils = {

	// Gestión de la fecha
	fechaConFormato: function (d) {
		let YYYY = d.getFullYear();
		let m = d.getMonth() + 1;
		let MM = m.toLocaleString('es-ES', { minimumIntegerDigits: 2, useGrouping: false })
		let DD = d.getDate().toLocaleString('es-ES', { minimumIntegerDigits: 2, useGrouping: false })
		let fecha = `${YYYY}-${MM}-${DD}`;
		return fecha;
	},
	fechaInicioFin: function (dias) {
		let inicio = new Date();
		let fin = new Date();
		fin.setDate(inicio.getDate() + (dias - 1));
		return {
			fechaInicio: utils.fechaConFormato(inicio),
			fechaFin: utils.fechaConFormato(fin)
		}
	},

	// Validación del número de días
	validaDias: function (diasTentativos) {
		let dias = 3
		if (diasTentativos) {
			let numDias = Number(diasTentativos);
			if (Number.isInteger(numDias)) {
				if (numDias >= 1 && numDias <= 11) {
					dias = numDias
				}
			}
		}
		return dias;
	},

	// Generar una fecha aleatoria mañana
	horaAleatoriaTomorrow: function (horaInicio, horaFin) {
		let ahora = new Date();
		let tomorrow = new Date();
		tomorrow.setDate(ahora.getDate() + 1);
		var hour = horaInicio + Math.random() * (horaFin - horaInicio) | 0;
		tomorrow.setHours(hour);
		return tomorrow;
	},

	// Convierte milisegunos a formato 'h m s ms'
	convertirTiempo: function (milisegundos) {
		var milis = milisegundos % 1000;
		milisegundos = parseInt(milisegundos / 1000);
		var segs = milisegundos % 60;
		milisegundos = parseInt(milisegundos / 60);
		var mins = milisegundos % 60;
		milisegundos = parseInt(milisegundos / 60);
		var horas = milisegundos % 24;
		var out = "";
		if (horas && horas > 0) out += horas + ((horas === 1) ? "h" : "h") + " ";
		if (mins && mins > 0) out += mins + ((mins === 1) ? "m" : "m") + " ";
		if (segs && segs > 0) out += segs + ((segs === 1) ? "s" : "s") + " ";
		if (milis && milis > 0) out += milis + ((milis === 1) ? "ms" : "ms") + " ";
		return out.trim();
	},

	readFileAsync: function (filename) {
		return new Promise(function (resolve, reject) {
			fs.readFile(filename, function (err, buffer) {
				if (err) reject(err); else resolve(buffer);
				});
			});
		},

		// Convierte un fichero XML a formato JSON
		convierteXMLaJSON: function (ficheroXML) {
			
			// Devuelvo una promise dado que leo en asíncrono
			return new Promise((resolve, reject) => {
			
				// Prepare the parser
				let parser = new xml2js.Parser();
			
				// Leemos el fichero XML
				console.log(`2 - Leyendo el fichero XML de movistar ${ficheroXML}`);
			
				//fs.readFile(ficheroXML, function (err, datosXML) {
				fs.readFile(ficheroXML, 'utf8', function (err, datosXML) {
					if (err) {
						console.log(`2 - Leyendo el fichero XML de movistar ${ficheroXML} !! ERROR !!`);
						reject(err);
					} else {
						console.log(`2 - Leyendo el fichero XML de movistar ${ficheroXML} - OK`);
						console.log(`3 - Parsing de XML(movistar) a JSON(movistar)`);

						
						// Reemplazamos los "&" problematicos por "&amp;"
						datosXML =datosXML.replace(/&/g, "&amp;")
						
						// Conversión de XML a JSON.
						parser.parseString(datosXML, function (err, result) {
							if (err) {
								console.log(`3 - Parsing de XML(movistar) a JSON(movistar) !! ERROR !!`);
								reject(err);
							} else {
								console.log(`3 - Parsing de XML(movistar) a JSON(movistar) - OK`);
								resolve(result);
							}
						});
					}
				});
			});
		},

		// Convierto el JSON desde formato Movistar a un JSON que será válido para crear el XMLTV.
		//
		// IMPORTANTE: El EPG (xml movistar) original no incluye la HORA DE FINALIZACIÓN de cada
		//             programa, y tvheadend lo necesita o no mostrará el EPG. Debemos hacer el
		//             cálculo nosotros mismos y tenemos 2 opciones:
		//
		//  1) Utilizar tv_sort (herramienta del proyecto XMLTV), lo haríamos después de terminar
		//     esta conversión. He detectado que la naturaleza de JSON desordena los programas
		//     y eso provoca que tv_sort se haga un lío.
		//
		//  2) Añadir el campo 'stop' nosotros mismos haciendo cálculos (partiendo de cuando empieza
		//     el siguiente programa de cada canal.
		//
		//  He decidido hacerlo yo mismo y el mejor sitio es en este método, dado que el
		//  el EPG en formato XML (movistar) original trate ya los programas ORDENADOS en
		//  el tiempo y el módulo xml2js que los convierte a JSON los MANTIENE ORDENADOS.
		//
		convierteJSONaJSONTV: function (progPreferences, datosJSON) {

			// Aquí guardaré el puntero a cada uno de los últimos pases (programa)
			// de modo que pueda usarlos para añadir la hora de "stop"
			let lastProgrammes = {};

			// Calcular el Timezone Offset, necesito añadirlo a las fechas
			// de start/stop para ser compatibles Tvheadend.
			let hrs = -(new Date().getTimezoneOffset() / 60)
			let sign = "";
			if (hrs < 0) { sign = '-'; }
			if (hrs > 0) { sign = '+'; }
			let offset = `${sign}${hrs.toLocaleString('es-ES', { minimumIntegerDigits: 2, useGrouping: false })}00`;

			// Empiezo a construir el Objeto JSON que tendrá un formato
			// tal que xml2js.Builder podrá convertirlo a XMLTV directamente...
			let jsontv = {
				tv: {
					"$": {
						"generator-info-name": 'byLuisPa, modded by pablozg',
					},
					channel: [],
					programme: []
				},
			}
			
			if (datosJSON.xml.export[0].pase === undefined) {
				console.log('=============================================')
				console.log('HE RECIBIDO UNA RESPUESTA VACIA !!!!!!!!!!!!!')
				console.log('=============================================')

				return {};

			} else {

				// Ordenamos los datos por canal y fecha
				datosJSON.xml.export[0].pase.sort((a, b) => a.$.cadena.localeCompare(b.$.cadena) || a.$.fecha.localeCompare(b.$.fecha));

				// Analizar cada pase
				datosJSON.xml.export[0].pase.forEach(function (pase) {

					// Busco el nombre de la cadena en cadenasHOME[]
					//
					// NOTA: ESTA VERSIÓ SOLO BUSCA EN cadenasHOME (ignora cadenasREMOTE) a la
					// hora de construir de convertir a JSONTV.
					//
					//
					let movistar_nombre = pase["$"].cadena;
					let index = progPreferences.cadenasHOME.findIndex(item => item.movistar_nombre === movistar_nombre);
					
					// si la cadena es vamos el nombre de peticion es distinto al que muestra en el xml, por lo que se para el index de forma forzada.
					if (index === -1 && movistar_nombre === "#Vamos") index = 0;

					if (index === -1) {
						console.log('=============================================')
						console.log('convierteJSONaJSONTV ...')
						console.log('ATENCIÓN NO PUEDO CONVERTIR EL SIGUIENTE CANAL');
						console.log('PORQUE NO LO TENGO DADO DE ALTA EN cadenasHOME');
						console.log(`movistar_nombre: ${movistar_nombre}`);
						console.log(`index: ${index}`);
						console.log('=============================================')
					} else {

						let channel_id = progPreferences.cadenasHOME[index].tvh_id;
						let display_name = progPreferences.cadenasHOME[index].tvh_nombre;

						// Busco el mismo programa en cadenasREMOTE, para añadir su display_name como alternativo.
						// Este truco facilita el que Tvheadend asigne automáticamente el EPG de cada cadena
						// al canal durante el proceso de creación de la Red->Muxes->Services->Channels en Tvheadend
						//let indexAlt = progPreferences.cadenasREMOTE.findIndex(item => item.movistar_nombre === movistar_nombre);
						//let display_name_alt = undefined;
						//if (indexAlt !== -1) {
						//   display_name_alt = progPreferences.cadenasREMOTE[indexAlt].tvh_nombre;
						//}

						// A pelo, el lenguaje siempre será 'es'
						let langES = 'es';

						// Para las categorías
						let langEN = 'en';

						// SECCIÓN 'channel'
						// -------------------

						// En el fichero origen (EPG de movistar) los nombres de los
						// canales vienen dentro de cada 'pase', así que voy a ir
						// descubriéndolos de forma dinámica.
						let isCanalGuardado = jsontv.tv.channel.findIndex(item => item["$"].id === channel_id) !== -1 ? true : false;
						if (!isCanalGuardado) {
							let channel = {
								"$": {
									"id": channel_id
								},
								"display-name": [
								{
									"_": display_name,
									"$": {
										"lang": langES
									}
								}
								]
							};
							/*if (display_name_alt !== undefined && display_name !== display_name_alt) {
							channel["display-name"].push({
							"_": display_name_alt,
							"$": {
							"lang": langES
							}
							});
							}*/
							jsontv.tv.channel.push(channel);
							progPreferences.numChannels = progPreferences.numChannels + 1;
						}

						// SECCIÓN 'programme'
						// -------------------

						// Convierto la fecha/hora del pase a formato objeto (Date) de modo que
						// pueda hacer operaciones de forma sencilla.
						// Añadido el substr para evitar coger el ">" previo a la fecha
						let [year, month, day] = pase["$"].fecha.substr(1, 11).split("-");
						let [hours, minutes, seconds] = pase.hora[0].split(":");
						let programmeStartDateObject = new Date(year, month - 1, day, hours, minutes, seconds, 0);

						// Si la hora de comienzo es mayor de las 00:00 y menor de las 06:00 se suma un dia a la fecha,
						// ya que la logica usada por movistar a cambiado.
						if (parseInt(hours) >= 0 && parseInt(hours) < 6){
							let tempDay = new Date(programmeStartDateObject);
							let nextDay = new Date(tempDay);

							nextDay.setDate(tempDay.getDate() + 1);

							year = nextDay.getFullYear();
							month = ('0' + (nextDay.getMonth() + 1)).slice(-2);
							day = ('0' + nextDay.getDate()).slice(-2);
						}

						// Convierto la fecha para el campo 'date' : YYYYMMMDD
						let programme_date = `${year}${month}${day}`;
						// Convierto la hora para el campo 'start' : YYYYMMMDDHHMMSS00 ?TTTT
						let programme_start = `${year}${month}${day}${hours}${minutes}${seconds} ${offset}`;

						// Añado mi start como el stop del pase anterior...
						if (lastProgrammes[channel_id] !== undefined) {
							let lastProgramme = lastProgrammes[channel_id];
							lastProgramme["$"].stop = programme_start;
						}

						// Convierto la Categoría a las soportadas por Tvheadend
						let categoria = utils.getCategoria(pase.tipo_ficha[0]);

						// Preparo el titulo y subtítulo desde el XML:
						// pase.descripcion_corta[0]: "título: subtítulo" o "título"
						// pase.titulo[0]: "subtítulo"
						// (OJO que el título puede que tenga también ":")
						let titulo = pase.descripcion_corta[0];
						let subtitulo = pase.titulo[0];

						////////////////// Procesamos el Título //////////////////

						let indexCaracter = null;
						let lastIndexCaracter = null;

						titulo = titulo.replace(/;/g," : ")
						.replace(/-/g," - ")
						.replace(/([\/\t]+(?=[\/\t])|^\s+|\s+$)/g, '')
						.replace(/(\/(?=[a-zA-Z0-9]))/g, '$1 ')
						.replace(/(\/(?![a-zA-Z0-9]))/g, ' $1')
						.replace(/([\ \t]+(?=[\ \t])|^\s+|\s+$)/g, '')
						.replace(/([\-\t]+(?=[\-\t])|^\s+|\s+$)/g, '')
						.replace(/([\;\t]+(?=[\;\t])|^\s+|\s+$)/g, '')
						.replace(/ [eE]p [0-9]\d*/g,"")
						.replace(/ [eE]pisodio.[0-9]\d*/g,"")
						.replace(/ [eE]p[.][0-9]*.\d*/g,"")
						.replace(/ [tT][0-9]\d*/g,"")
						.replace(/ \([tT]emp [0-9]\d*\)/g,"")
						.replace(/ \([tT]emp\. [0-9]\d*\)/g,"")
						.replace(/ \([tT]emp\.[0-9]\d*\)/g,"")
						.replace(/ [tT]emp [0-9]\d*/g,"")
						.replace(/ [tT]emp\. [0-9]\d*/g,"")
						.replace(/ [tT]emp\.[0-9]\d*/g,"")
						.replace(/ [tT]emporada [0-9]\d*/g,"")
						.replace(/ \([0-9]*\)/g,"")
						.replace(/ [0-9]\.(?![0-9])/g,"")
						.replace(/ [eE]pisode.[0-9]\d*/g,"")
						.replace(/ [sS] [0-9]\d*/g,"")
						.replace(/ [sS][0-9]\d*/g,"")
						.replace(/ [sS]eason [0-9]\d*/g,"")
						.replace(/\(VOS\)/g,"");

						subtitulo = subtitulo.replace(/;/g," - ")
						.replace(/-/g," - ")
						.replace(/([\/\t]+(?=[\/\t])|^\s+|\s+$)/g, '')
						.replace(/(\/(?=[a-zA-Z0-9]))/g, '$1 ')
						.replace(/(\/(?![a-zA-Z0-9]))/g, ' $1')
						.replace(/([\ \t]+(?=[\ \t])|^\s+|\s+$)/g, '')
						.replace(/([\-\t]+(?=[\-\t])|^\s+|\s+$)/g, '')
						.replace(/([\;\t]+(?=[\;\t])|^\s+|\s+$)/g, '');

						let tempTitulo = titulo.toLowerCase();
						let tempSubtitulo = subtitulo.toLowerCase();

						// Eliminamos cualquier caracter no alphanúmerico y los acentos

						tempSubtitulo = tempSubtitulo.normalize('NFD')
						.replace(/([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,"$1")
						.normalize()
						//.replace(/\W/g, ' ')
						.replace(/\¿/g,"")
						.replace(/\?/g,"")
						.replace(/([\ \t]+(?=[\ \t])|^\s+|\s+$)/g, '');

						tempTitulo = tempTitulo.normalize('NFD')
						.replace(/([^n\u0300-\u036f]|n(?!\u0303(?![\u0300-\u036f])))[\u0300-\u036f]+/gi,"$1")
						.normalize()
						//.replace(/\W/g, ' ')
						.replace(/\¿/g,"")
						.replace(/\?/g,"")
						.replace(/([\ \t]+(?=[\ \t])|^\s+|\s+$)/g, '');

						// Si el subtitulo está incluido en el título

						let newTitulo = "";
						let newSubtitulo = "";

						if (tempTitulo.includes(tempSubtitulo) == true && tempTitulo.length > tempSubtitulo.length){

							// Buscamos primero el subtitulo en el titulo sin adaptar, si no se encuentra
							// lo buscamos con el subtitulo y titulo adaptado
							let inicioSubtitulo = titulo.indexOf(subtitulo);
							if (inicioSubtitulo === -1) inicioSubtitulo = tempTitulo.indexOf(tempSubtitulo);

							var subSymbol = [":", "("];
							let firstDoubleDot = null;
							let lastDoubleDot = null;

							for (let i=0; i<=subSymbol.length; i++){
								firstDoubleDot = titulo.indexOf(subSymbol[i]);
								if (firstDoubleDot !== -1) i = subSymbol.length + 1;
							}

							lastDoubleDot = titulo.lastIndexOf(":");
							if (lastDoubleDot === -1) lastDoubleDot = firstDoubleDot;

							let subtituloInTitulo = "";

							// Si el subtítulo comienza detrás de los primeros dos puntos.
							if (inicioSubtitulo >= firstDoubleDot && inicioSubtitulo > 0){

								if (firstDoubleDot !== -1 &&
								firstDoubleDot < lastDoubleDot &&
								lastDoubleDot < inicioSubtitulo) inicioSubtitulo = lastDoubleDot + 1;

								if (firstDoubleDot !== -1 && firstDoubleDot === lastDoubleDot) inicioSubtitulo = firstDoubleDot + 1;

								subtituloInTitulo = titulo.substring(inicioSubtitulo, titulo.length);
								titulo = titulo.substr(0, inicioSubtitulo);
							}else{
								// Si el subtítulo al principio del título
								if (firstDoubleDot !== -1){
									subtituloInTitulo = titulo.substring(firstDoubleDot + 1, titulo.length);
									titulo = titulo.substr(0, firstDoubleDot);
								}
							}

							if (subtituloInTitulo.indexOf('(') === -1){
								newSubtitulo = subtituloInTitulo.replace(")","")
								.trim();
							}else{
								newSubtitulo = subtituloInTitulo;
							}

							if (titulo.indexOf(subtituloInTitulo) > 0) titulo = titulo.replace(subtitulo,"");

						}else{

							// Buscamos la exitencia de ':'
							indexCaracter = titulo.indexOf(':');
							if (indexCaracter === -1) indexCaracter = titulo.indexOf('-');
							if (indexCaracter === -1) indexCaracter = titulo.length;

							lastIndexCaracter = titulo.lastIndexOf(':');
							if (lastIndexCaracter === -1) lastIndexCaracter = indexCaracter;

							newTitulo = titulo.substr(0, lastIndexCaracter);

							if (lastIndexCaracter !== titulo.length) newSubtitulo = titulo.substr(lastIndexCaracter + 1, titulo.length);

							// Buscamos la exitencia de '('
							indexCaracter = newTitulo.indexOf('(');

							if (indexCaracter !== -1){
								newTitulo = newTitulo.substr(0, indexCaracter);
							}

							// Buscamos la exitencia de ';'
							indexCaracter = newTitulo.indexOf(';');

							if (indexCaracter !== -1){
								newTitulo = newTitulo.substr(0, indexCaracter);
							}

							// Buscamos la exitencia de '-'
							indexCaracter = newTitulo.indexOf('-');

							if (indexCaracter !== -1){
								newTitulo = newTitulo.substr(0, indexCaracter);
							}

							// Si se la cedena newTitulo no esta vacía y es más corta que la original se procesa, en caso contrario se deja como está.
							if (newTitulo.length < titulo.length) titulo = newTitulo;
						}

						// Si el subtitulo no está incluido en el título

						titulo = titulo.trim()
						.replace(";","")
						.replace(/-/g,"");

						if (newSubtitulo !== "") newSubtitulo = newSubtitulo.trim();

						if (titulo.lastIndexOf(":") == titulo.length - 1) titulo = titulo.substring(0, titulo.length - 1);

						////////////////// Procesamos el Subtítulo //////////////////

						tempSubtitulo = subtitulo.replace(titulo,"");

						if (tempSubtitulo !== ""){

							/// Eliminamos las referencias a (VOS), Ep XXX, Episodio XXXX, Ep. XXX, Temp XXX, etc.

							subtitulo = subtitulo.replace(titulo,"")
							.replace(/[eE]p [0-9]\d*/g,"")
							.replace(/[eE]p[.][0-9]*.\d*/g,"")
							.replace(/[eE]pisodio.[0-9]\d*/g,"")
							.replace(/[eE]pisode.[0-9]\d*/g,"")
							.replace(/[tT][0-9]\d*/g,"")
							.replace(/[tT]emporada [0-9]\d*/g,"")
							.replace(/\([tT]emp [0-9]\d*\)/g,"")
							.replace(/\([tT]emp\. [0-9]\d*\)/g,"")
							.replace(/\([tT]emp\.[0-9]\d*\)/g,"")
							.replace(/[tT]emp [0-9]\d*/g,"")
							.replace(/[tT]emp\. [0-9]\d*/g,"")
							.replace(/[tT]emp\.[0-9]\d*/g,"")
							.replace(/\([0-9]*\)/g,"")
							.replace(/[sS] [0-9]\d*/g,"")
							.replace(/[sS][0-9]\d*/g,"")
							.replace(/[sS]eason [0-9]\d*/g,"")
							.replace("(VOS)","")
							.replace(";","")
							.replace(",","")
							.replace(":","")
							.replace(/-/g,"")
							.replace(/([\ \t]+(?=[\ \t])|^\s+|\s+$)/g, '')
							.trim();

							if (newSubtitulo !== "" || (newSubtitulo.includes(subtitulo) == true && newSubtitulo.length > subtitulo.length)){
								subtitulo = newSubtitulo;
							}else{
								if (pase.titulo[0].includes(subtitulo) == false || subtitulo === "") subtitulo = pase.titulo[0];
							}
						}else{
							if (newSubtitulo !== "" && subtitulo === titulo) subtitulo = newSubtitulo;
						}

						// Nos aseguramos que no queda ningún espacio fuera de lugar
						titulo = titulo.trim();
						subtitulo = subtitulo.trim();

						////////////////// Procesamos la Temporada y el capítulo //////////////////

						// Sacamos la temporada si existe

						let newTemporada = ' ';
						let expresionTemporada = null;

						// Buscamos la temporada en formato TXXXX
						expresionTemporada = pase.descripcion_corta[0].match(/ [tT][0-9]\d*/g);

						// Buscamos la temporada en formato Temp XXXX
						if (expresionTemporada == null) expresionTemporada = pase.descripcion_corta[0].match(/[tT]emp [0-9]\d*/g);

						// Buscamos la temporada en formato (Temp XXXX)
						if (expresionTemporada == null) expresionTemporada = pase.descripcion_corta[0].match(/\([tT]emp [0-9]\d*\)/g);

						// Buscamos la temporada en formato Temp. XXXX
						if (expresionTemporada == null) expresionTemporada = pase.descripcion_corta[0].match(/[tT]emp\. [0-9]\d*/g);

						// Buscamos la temporada en formato Temp.XXXX
						if (expresionTemporada == null) expresionTemporada = pase.descripcion_corta[0].match(/[tT]emp\.[0-9]\d*/g);

						// Buscamos la temporada en formato (Temp. XXXX)
						if (expresionTemporada == null) expresionTemporada = pase.descripcion_corta[0].match(/\([tT]emp\. [0-9]\d*\)/g);

						// Buscamos la temporada en formato (Temp.XXXX)
						if (expresionTemporada == null) expresionTemporada = pase.descripcion_corta[0].match(/\([tT]emp\.[0-9]\d*\)/g);

						// Buscamos la temporada en formato (T XXXX)
						if (expresionTemporada == null) expresionTemporada = pase.descripcion_corta[0].match(/[tT] [0-9]\d*/g);

						// Buscamos la temporada en formato (TXXXX)
						if (expresionTemporada == null) expresionTemporada = pase.descripcion_corta[0].match(/[tT][0-9]\d*/g);

						// Buscamos la temporada en formato Season XXXX
						if (expresionTemporada == null) expresionTemporada = pase.descripcion_corta[0].match(/[sS]eason [0-9]\d*/g);

						// Buscamos la temporada en formato (XXXX)
						if (expresionTemporada == null) expresionTemporada = pase.descripcion_corta[0].match(/\([0-9]*\)/g);

						// Extraemos los números de la cadena
						if (expresionTemporada !== null)
						{
							newTemporada = expresionTemporada[0].match(/[0-9]\d*/g);
						}

						//// Sacamos el episodio si existe
						let newCapitulo = ' ';

						// Buscamos el episodio en formato Ep XXXX, si coincide indicamos que solo se copien los dos útimos digitos
						let expresionCapitulo = pase.descripcion_corta[0].match(/[eE]p [0-9]\d*/g);

						// Buscamos el episodio en formato Episodio XXXX
						if (expresionCapitulo == null) expresionCapitulo = pase.descripcion_corta[0].match(/[eE]pisodio.[0-9]\d*/g);

						// Buscamos el episodio en formato Episode XXXX
						if (expresionCapitulo == null) expresionCapitulo = pase.descripcion_corta[0].match(/[eE]pisode.[0-9]\d*/g);

						// Buscamos el episodio en formato Ep. XXXX
						if (expresionCapitulo == null) expresionCapitulo = pase.descripcion_corta[0].match(/[eE]p[.][0-9]*.\d*/g);

						// Buscamos el episodio en formato XXXX.
						if (expresionCapitulo == null) expresionCapitulo = pase.descripcion_corta[0].match(/[0-9]\.(?![0-9])/g);

						// Si en el título no se incluye Episodio Buscamos en el subtitulo en formato Episodio XXXX
						if (expresionCapitulo == null) expresionCapitulo = pase.titulo[0].match(/[eE]pisodio.[0-9]\d*/g);

						// Si en el título no se incluye Episodio Buscamos en el subtitulo en formato Episode XXXX
						if (expresionCapitulo == null) expresionCapitulo = pase.titulo[0].match(/[eE]pisode.[0-9]\d*/g);

						// Si en el título no se incluye Episodio Buscamos en el subtitulo en formato XXXX.
						if (expresionCapitulo == null) expresionCapitulo = pase.titulo[0].match(/[0-9]\.(?![0-9])/g);

						// Extraemos los números de la cadena
						if (expresionCapitulo !== null)
						{

							let space = expresionCapitulo[0].indexOf(" ");
							newCapitulo = expresionCapitulo[0].substr(expresionCapitulo[0].length - 2, 2);

							if (newTemporada === ' ' && expresionCapitulo[0].length - 2 > space)
							newTemporada = expresionCapitulo[0].substring(space + 1, expresionCapitulo[0].length - 2);

						}

						if (newCapitulo !== ' '){

							pase.sinopsis_larga[0] = "Episodio " + newCapitulo + " - " + pase.sinopsis_larga[0];

							newCapitulo = parseInt(newCapitulo) - 1;
						}

						if (newTemporada !== ' '){

							// Comprobamos que efectivamente es una temporada y no un año midiendo su logitud
							if (newTemporada.length <= 2){

								if (newCapitulo === ' ')  pase.sinopsis_larga[0] = "- " + pase.sinopsis_larga[0];
								pase.sinopsis_larga[0] = "Temporada " + newTemporada + " " + pase.sinopsis_larga[0];
								newTemporada = parseInt(newTemporada) - 1;
							}else{
								newTemporada = ' ';
							}
						}

						// Generamos la información de episodio siguiente este formato : <episode-num system="xmltv_ns">2 . 9 . 0/1</episode-num>

						let episodio = ' ';

						if (newTemporada !== ' ' || newCapitulo !== ' '){
							episodio = newTemporada.toString() + " . " + newCapitulo.toString() + " . 0/1";
						}else{
							episodio = subtitulo;
						}


						// --------------------------------------------------------------------------
						//  INICIO ZONA PERSONALIZADA !!!
						//
						//  Recordemos que este código está pensado para cuando trabajamos con
						//  Tvheadend como backend y KODI como dispositivos.
						//
						//  En esta sección voy a hacer un par de cosas que puedes, si no te convence,
						//  comentar en tu caso.
						//
						//  - Me he dado cuenta que casi todas las "Pelis" empiezan con un título
						//    "Cine*" así que lo cambio a "Película: nombr de la peli"
						//
						//  - Como NO viene la "Categoría" de cada pase, pues hago lo que puedo
						//    desde los datos que tenemos, por ejemplo, casi todas las "Pelis"
						//    tiene como título "Cine*", así que les asigno categoría "Movies..."
						//
						//  - Como ciertos canales sabemos que SON SÍ O SÍ de deportes, pues le
						//    caso a todos sus programas la categoría "Sports..."
						//
						//  - Las categorías que utilizo son las compatibles con Tvheadend !!!!!!
						//
						// "Movie / Drama"
						// "News / Current affairs"
						// "Show / Game show"
						// "Sports"
						// "Children's / Youth programs"
						// "Music / Ballet / Dance"
						// "Arts / Culture (without music)"
						// "Social / Political issues / Economics"
						// "Education / Science / Factual topics"
						// "Leisure hobbies"
						//
						// --------------------------------------------------------------------------

						// - Si viene "Cine" en el título y "Título de la peli" en el subtítulo
						//   lo cambio por titulo:"Película: título de la peli" y subtitulo:"título de la peli".
						//
						// Al entrar en los detalles de la emisión se hace redudante pero
						// en la guia que tenemos en Kodi->Tv->Guia se ve muchísimo mejor.
						//

						// Categoría por TIPO DE CADENA (ver cadenas*.js)
						if ( progPreferences.cadenasHOME[index].tvh_categoria ) {
							categoria = progPreferences.cadenasHOME[index].tvh_categoria;
						}

						// "switch(true)" abominable que no funciona en otros lenguajes :-)
						// http://stackoverflow.com/questions/2896626/switch-statement-for-string-matching-in-javascript
						let str = titulo.toLowerCase();
						switch (true) {

							// Fútbol: partidos
							case /laliga/.test(str):
							if (subtitulo.toLowerCase() !== "laliga") {
								titulo = "Fútbol: " + subtitulo;
							}
							categoria = "Football / Soccer";
							break;

							// Documentales
							case /^dok xtra/.test(str):
							categoria = "Social / Political issues / Economics";
							break;

							// Cine
							case /corto/.test(str):
							categoria = "Movie / Drama";
							break;
							case /cine/.test(str):
							case /cine estreno/.test(str):
							case /cine xtra/.test(str):
							case /cine inédito/.test(str):
							case /^cine : /.test(str):
							if ( str === "cine" && subtitulo.toLowerCase() === "cine" && pase.sinopsis_larga[0] === "Emisión de una película." ) {
								titulo = "Película"
								subtitulo = "Emisión de una película."
								categoria = "Movie / Drama";
							} else {
								if (subtitulo.toLowerCase() !== "cine") {
									titulo = "Película: " + subtitulo;
								}
							}
							categoria = "Movie / Drama";
							break;
							case /^cinexpress/.test(str):
							case /^cinema-trix/.test(str):
							case /^cine /.test(str):
							categoria = "Movie / Drama";
							break;
							default:
							break;
						}
						// --------------------------------------------------------------------------
						//  FIN ZONA PERSONALIZADA !!!
						// --------------------------------------------------------------------------


						// --------------------------------------------------------------------------
						// Conversión al nuevo formato
						// --------------------------------------------------------------------------

						// Preparo el pase en el nuevo formato
						//
						let programme = {
							"$": {
								"start": `${programme_start}`,
								"channel": channel_id
							},
							"title": [
							{
								"_": titulo,
								"$": {
									"lang": langES
								}
							}
							],
							"sub-title": [
							{
								"_": subtitulo,
								"$": {
									"lang": langES
								}
							}
							],
							"desc": [
							{
								"_": pase.sinopsis_larga[0],
								"$": {
									"lang": langES
								}
							}
							],
							"date": [
							{
								"_": `${programme_date}`
							}
							],
							"category": [
							{
								"_": categoria,
								"$": {
									"lang": langES
								}
							}
							]
						};

						// Añado el episodio en caso de estar definido
						if (newTemporada !== ' ' || newCapitulo !== ' '){
							programme['episode-num'] = [
							{
								"_": episodio,
								"$": {
									"system": "xmltv_ns"
								}
							}
							];
						}else{
							programme['episode-num'] = [
							{
								"_": episodio,
								"$": {
									"system": "onscreen"
								}
							}
							];
						}

						// Salvo el puntero a este programme para poder
						// añadirle el 'stop' cuando descubra el siguiente (start)
						lastProgrammes[channel_id] = programme;

						// Añado el programa al buffer de salida
						jsontv.tv.programme.push(programme);
						progPreferences.numProgrammes = progPreferences.numProgrammes + 1;
					}
				});
			}
			return (jsontv);
		},

		// Tvheadend reconoce la categoría xmltv solo si coincide con alguna de las
		// definidas en el estándar DVB. Ver el fuente de tvheadend/src/epg.c
		// https://github.com/tvheadend/tvheadend/blob/master/src/epg.c
		// Además, solo tiene 10 configuradas. Este método mapea las que vienen
		// de Movistar a una de estas 10.
		//
		getCategoria: function (original) {
			switch (original) {
				case 'Programa':
				return "Social / Political issues / Economics";
				case 'Seriado':
				return "Show / Game show"
				default:
				return "Social / Political issues / Economics";
			}
			return original;
		},


		// Convierto de formato JSONTV a XMLTV
		convierteJSONTVaXMLTV: function (datosJSONTV) {
			// Preparo el builder
			let builder = new xml2js.Builder({ headless: false }); //true

			// Devuelvo la Conversión
			return builder.buildObject(datosJSONTV);
		}

	}

	export default utils;
