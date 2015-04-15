window.onload = function () {
	var default_w = (window.width || document.body.offsetWidth) * .1,
		default_h = (window.width || document.body.offsetWidth) * .1,
		mediaElement = document.getElementById('media'),
		mediaManager = new cast.receiver.MediaManager(mediaElement),
		appConfig = new cast.receiver.CastReceiverManager.Config(),
		castReceiverManager = cast.receiver.CastReceiverManager.getInstance(),
		messageBus, imgdatachunks = {}, imgdatasize = {}, imgdataencoding = {};

	function setPattern(which, data, sendLoadComplete) {
		var containerElement = which == 'background' ? document.body : mediaElement,
			img, imgdata, imgs = [];
		if (typeof(data) != 'string' ||
			data.indexOf('http:') === 0 ||
			data.indexOf('https:') === 0 ||
			data.indexOf('data:image') === 0 ||
			data.indexOf('size:') === 0 ||
			imgdatasize[which] > 0) {
			// Allow image URL for patterncolor and background color
			if (typeof(data) != 'string') {
				if (data.encoding != 'base64') return which + ' image data encoding not supported: ' + JSON.stringify(data.encoding);
				if (!data.data) return 'No image data given for ' + which;
				if (typeof data.data != 'string') return 'Invalid ' + which + ' image data type: ' + typeof data.data;
				if (!data.contentType) return 'No image data content type given for ' + which;
				if (typeof data.contentType != 'string') return which + ' image data content type is not a string: ' + JSON.stringify(data.contentType);
				if (['image/gif', 'image/jpeg', 'image/png'].indexOf(data.contentType) < 0) return which + ' image data content type not supported: ' + JSON.stringify(data.contentType);
				if (!data.size) return 'Invalid ' + which + ' image data size: ' + data.size;
				if (typeof data.size != 'number') return which + ' image data size is not a number: ' + JSON.stringify(data.size);
				if (data.data.length > data.size) return 'Actual ' + which + ' image data size ' + data.data.length + ' is above indicated size ' + data.size;
				imgdatachunks[which] = ['data:', data.contentType || 'image/png',
										data.encoding ? ';' + data.encoding : '',
										','];
				imgdatasize[which] = imgdatachunks[which].join('').length + (parseInt(data.size) || data.data.length);
				imgdatachunks[which].push(data.data);
				imgdataencoding[which] = data.encoding;
			}
			else if (data.indexOf('http:') === 0 ||
				data.indexOf('https:') === 0 ||
				data.indexOf('data:image') === 0) {
				imgdatasize[which] = data.length;
				imgdatachunks[which] = [data];
			}
			else if (data.indexOf('size:') === 0) {
				imgdatasize[which] = parseInt(data.split(':', 2)[1]);
				imgdatachunks[which] = [data.split(';').slice(1).join(';')];
			}
			else imgdatachunks[which].push(data);
			imgdata = imgdatachunks[which].join('');
			if (imgdata.length == imgdatasize[which]) {
				// Detecting base64 encoding errors isn't very reliable, because even bogus strings might decode without error
				//if (imgdataencoding[which] == 'base64') {
					//// Try to decode base64
					//var base64 = imgdata.split(',')[1]
					//try {
						//atob(base64)
					//} catch (e) {
						//return e + ' ' + JSON.stringify(base64)
					//}
				//}
				imgdatasize[which] = -1;
				img = new Image();
				img.onload = function () {
					this._containerElement.style.backgroundImage = 'url("' + this.src + '")';
					this._loaded = true;
					if (sendLoadComplete) {
						// Check if all images loaded
						for (var j = 0; j < imgs.length; j ++) if (!imgs[j]._loaded) break;
						if (j == imgs.length) mediaManager.sendLoadComplete();
					}
				}
				img._containerElement = containerElement;
				imgs.push(img);
				img.src = imgdata;
			}
			else if (imgdata.length > imgdatasize[which]) return 'Actual ' + which + ' image data size is above expected size';
		}
		else if (which == 'background') containerElement.style.backgroundColor = data;
		else return 'Invalid ' + which + ' definition: ' + JSON.stringify(data);
		if (!imgs.length && sendLoadComplete) mediaManager.sendLoadComplete();
	}

	function setOffsetScale(ho, vo, ss, vs) {
		var x, y, w, h, offset = [ho, vo], scale = [ss, vs];
		for (var i = 0; i < 2; i ++) {
			if (scale[i] != null) {
				if (isNaN(scale[i])) return 'scale[' + i + '] is not a number: ' + JSON.stringify(scale[i]);
				else if (scale[i] < 0 || scale[i] > 50) return 'scale[' + i + '] is out of range 0...50: ' + JSON.stringify(scale[i]);
			}
			if (offset[i] != null) {
				if (isNaN(offset[i])) return 'offset[' + i + '] is not a number: ' + JSON.stringify(offset[i]);
				else if (offset[i] < 0 || offset[i] > 1) return 'offset[' + i + '] is out of range 0...1: ' + JSON.stringify(offset[i]);
			}
		}
		if (ss) {
			w = Math.round(parseFloat(ss) * default_w);
			mediaElement.style.width = w + 'px';
		}
		if (vs || ss) {
			h = Math.round(parseFloat(vs || ss) * default_h);
			mediaElement.style.height = h + 'px';
		}
		if (ho != null) {
			x = parseFloat(ho) * ((window.width || document.body.offsetWidth) - mediaElement.offsetWidth);
			mediaElement.style.left = x + 'px';
		}
		if (vo != null) {
			y = parseFloat(vo) * ((window.height || document.body.offsetHeight) - mediaElement.offsetHeight);
			mediaElement.style.top = y + 'px';
		}
	}

	castReceiverManager.onReady = function (event) {
		castReceiverManager.setApplicationState('Pattern generator ready');
	};

	messageBus = castReceiverManager.getCastMessageBus('urn:x-cast:net.hoech.cast.patterngenerator',
													   cast.receiver.CastMessageBus.MessageType.JSON);
	messageBus.onMessage = function (event) {
		/**
		 * Receive data via custom message bus.
		 *
		 * Actual data payload for the first (or only) message for each
		 * pattern should be
		 *
		 * {
		 *     "foreground": {
		 *         "contentType": "image/png",
		 *         "encoding": "base64",
		 *         "data": "<1st chunk of encoded image data>",
		 *         "size": <size of whole encoded image data in bytes>
		 *     },
		 *     "background": "rgb(<R>, <G>, <B>)",
		 *     "offset": [<offset_h>, <offset_v>],
		 *     "scale": [<scale_h>, <scale_v>]
		 * }
		 * 
		 * Keys other than "foreground" are optional.
		 * "foreground", "background" values can also be colors given
		 * as hex strings e.g. "#3C0" or RGB e.g. "rgb(51, 204, 0)".
		 * <offset_h>, <offset_v> should be given as relative position 0.0..1.0.
		 * <scale_h>, <scale_v> should be given as scaling factor 0.0..50.0.
		 *
		 * In case of data URLs, the payload may need to be split
		 * to stay within the 64K transport message size limit
		 * (see https://developers.google.com/cast/docs/reference/messages).
		 *
		 * To accomodate this, the first message must indicate the size
		 * of the whole encoded image data string in bytes as above,
		 * and subsequent messages should just contain chunks of the
		 * remaining data. E.g.
		 *
		 * {
		 *     "foreground": "<nth chunk of encoded image data>"
		 * }
		 *
		 **/
		var data = event.data, errors = [];
		console.log('Received message from sender ID ' + JSON.stringify(event.senderId) + ', request ID ' + data.requestId);
		if (data.scale) {
			if (!data.scale.length || data.scale.length > 2) error = 'scale is not an array of length 2 or 1: ' + JSON.stringify(data.scale);
			else error = setOffsetScale(null, null, data.scale[0], data.scale[1]);
			if (error) errors.push(error);
		}
		if (data.offset) {
			if (!data.offset.length || data.offset.length > 2) error = 'offset is not an array of length 2 or 1: ' + JSON.stringify(data.offset);
			else error = setOffsetScale(data.offset[0], data.offset[1]);
			if (error) errors.push(error);
		}
		if (data.foreground) {
			error = setPattern('foreground', data.foreground);
			if (error) errors.push(error);
		}
		if (data.background) {
			error = setPattern('background', data.background);
			if (error) errors.push(error);
		}
		if (errors.length) {
			castReceiverManager.setApplicationState('Pattern generator request ID ' + data.requestId + ' failed');
			messageBus.send(event.senderId, {'requestId': data.requestId, 'type': 'NACK', 'errors': errors});
		}
		else {
			castReceiverManager.setApplicationState('Pattern generator request ID ' + data.requestId + ' OK');
			messageBus.send(event.senderId, {'requestId': data.requestId, 'type': 'ACK'});
		}
	};

	mediaManager.onLoad = function (event) {
		var data, items, errors = [];
		if (event.data['media'] && (event.data['media']['contentId'] || event.data['media']['customData'])) {
			/**
			 * NOTE that receiving data via the LOAD command is just
			 * available for backwards compatibility. The recommended
			 * way is to use the custom message bus.
			 *
			 * Data must be an image URL or a string in the form:
			 * "<foreground>|<background>|<offset_h>|<offset_v>|<scale_h>|<scale_v>"
			 * Values other than <foreground> are optional.
			 * <foreground>, <background> can be colors given as hex
			 * strings e.g. "#3C0", RGB e.g. "rgb(51, 204, 0)", or
			 * image URLs.
			 * <offset_h>, <offset_v> should be given as relative position 0.0..1.0.
			 * <scale_h>, <scale_v> should be given as scaling factor 0.0..50.0.
			 *
			 * In case of data URLs, the payload may need to be split
			 * to stay within the 64K transport message size limit
			 * (see https://developers.google.com/cast/docs/reference/messages).
			 *
			 * To accomodate this, the first message must indicate
			 * the size of the whole data string in bytes (i.e.
			 * including "data:image"), and subsequent messages should
			 * just contain chunks of the remaining data. E.g.
			 *
			 * 1st message: "size:128000;data:image/png;base64,<first chunk of encoded image data>"
			 * 2nd message: "<second chunk of encoded image data>"
			 * Etc.
			 */
			if (event.data['media']['customData'])
				data = event.data['media']['customData'];
			else
				data = event.data['media']['contentId'];
			if (typeof(data) == 'string') {
				items = data.split('|');
				error = setOffsetScale(items[2], items[3], items[4], items[5]);
				if (error) errors.push(error);
				for (var i = 0; i < 2; i ++) if (items[i]) {
					error = setPattern(i ? 'background' : 'foreground', items[i], true);
					if (error) errors.push(error);
				}
				if (errors.length) {
					castReceiverManager.setApplicationState('Pattern generator request ID ' + event.data.requestId + ' failed');
					messageBus.send(event.senderId, {'requestId': event.data.requestId, 'type': 'NACK', 'errors': errors});
				}
				else castReceiverManager.setApplicationState('Pattern generator request ID ' + event.data.requestId + ' OK');
			}
			else messageBus.onMessage(event);
		}
		else this.sendLoadError();
	};

	/**
	 * Text that represents the application status. It should meet
	 * internationalization rules as may be displayed by the sender application.
	 * @type {string|undefined}
	 **/
	appConfig.statusText = 'Pattern generator starting...';

	/**
	* Maximum time in seconds before closing an idle
	* sender connection. Setting this value enables a heartbeat message to keep
	* the connection alive. Used to detect unresponsive senders faster than
	* typical TCP timeouts. The minimum value is 5 seconds, there is no upper
	* bound enforced but practically it's minutes before platform TCP timeouts
	* come into play. Default value is 10 seconds.
	* @type {number|undefined}
	**/
	appConfig.maxInactivity = 10;

	castReceiverManager.start(appConfig);

	// Useful to have these available globally for debugging
	window.mediaManager = mediaManager;
	window.castReceiverManager = castReceiverManager;
};