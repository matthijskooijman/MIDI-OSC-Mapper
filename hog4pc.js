"use strict";

var core = require('./core.js')
var util = require('./util.js')

const FB_STRIP_BUTTONS    = 1 // Button status for strips.
const FB_STRIP_VALUES     = 2 // Variable control values for strips.
const FB_SSID_AS_PATH     = 4 // Send SSID as path extension.
const FB_HEARTBEAT        = 8 // heartbeat to surface.
const FB_MASTER           = 16 // Enable master section feedback.
const FB_BAR_BEAT         = 32 // Send Bar and Beat.
const FB_TIMECODE         = 64 // Send timecode.
const FB_METER_FADER_MODE = 128 // Send meter as dB (-193 to +6) or 0 to 1 depending on gainmode
const FB_METER_BITS       = 256 // Send meter a 16 bit value where each bit is a level and all bits of lower level are on. For use in a LED strip. This will not work if the above option is turned on.
const FB_SIGNAL_PRESENT   = 512 // Send signal present, true if level is higher than -40dB
const FB_POSITION_SAMPLES = 1024 // Send position in samples
const FB_POSITION_TIME    = 2048 // Send position in time, hours, minutes, seconds and milliseconds
const FB_SELECT_CHANNEL   = 8192 // Turn on select channel feedback
const FB_OSC_1_REPLY      = 16384 // Use OSC 1.0 /reply instead of #reply
const FB_TRIGGER_GRID     = 32768
const FB_MIXER_SCENE      = 65536
const FB_ALL_PLUGINS      = 131072


const BANK_SIZE = 22
const STRIP_TYPES = 159 // All but hidden and special, probably affects strip number interpretation?
// TODO: Can FB_OSC_1_REPLY be omitted now https://github.com/Ardour/ardour/pull/900 is merged? Older notes suggest so, but I now no longer understand why?
const FEEDBACK = FB_STRIP_BUTTONS | FB_STRIP_VALUES | FB_MASTER | FB_SELECT_CHANNEL | FB_OSC_1_REPLY | FB_ALL_PLUGINS
const FADER_MODE = 2 // Fader feedback uses both dB and fader position
const SEND_PAGE_SIZE = 0 // TODO
const PLUGIN_PAGE_SIZE = 0 // TODO

const NUM_MASTERS = 20 // TODO
const NUM_WHEELS = 4 // TODO

class Application extends core.Application {
    plugin_info = {}
    strip_info = {}
    selected_strip_ssid
    selected_plugin_id
    expected_plugin_changes = []
    plugin_values_for_strip

    constructor({target, init_complete}) {
        super({target})
        this.init_complete_callback = init_complete
    }

    reload() {
        this.init()
    }

    init() {
        this.initControls()

        console.info("Calling init_complete_callback")
        this.init_complete_callback()
    }

    processMessage(address, args) {
	return super.processMessage(address, args)
    }

    initControls() {
	for(let num = 1; num <= NUM_MASTERS; num++)
	    this.addControlsForMaster(num) 
	let keys = [
	    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
	    'plus', 'minus', 'slash', 'period', 'thru', 'backspace', 'at', 'full', 'enter',
	    'pig', 'clear',
	]
	for (const name of keys) {
	    this.addControl(`key_${name}`, {
		type: 'button',
		address: `/hog/hardware/${name}`,
		// TODO: Make this more concise, maybe a mode similar to button widgets?
		tap: 1,
		release: 0,
	    })
	}
	this.addControl(`cmdline`, {
	    type: 'text',
	    address: '/hog/status/commandline',
	})
	for(let num = 1; num <= NUM_WHEELS; num++) {
	    this.addControl('wheel_' + num, {
		type: 'fader',
		address: '/hog/hardware/encoderwheel/' + num,
		range: {"min": -20, "max": 20},
		// TODO: Feedback comes in on /status
		// TODO: Output should be relative (positive to add, negative to subtract)
		// This would also require modifying the surface control to be relative (i.e. infinite)
	    })
	}
	    
    }

    addControlsForMaster(num) {
        let self = this

        this.addControl('master_' + num + '_fader', {
            type: 'fader',
            address: '/hog/hardware/fader/' + num,
            range: {"min": 0, "max": 255},
        })
        this.addControl('master_' + num + '_choose', {
            type: 'button',
            address: '/hog/hardware/choose/' + num,
	    tap: 1,
	    release: 0,
        })
        this.addControl('master_' + num + '_go', {
            type: 'button',
            address: '/hog/hardware/go/' + num,
	    tap: 1,
	    release: 0,
        })
        this.addControl('master_' + num + '_pause', {
            type: 'button',
            address: '/hog/hardware/pause/' + num,
	    tap: 1,
	    release: 0,
        })
        this.addControl('master_' + num + '_goback', {
            type: 'button',
            address: '/hog/hardware/goback/' + num,
	    tap: 1,
	    release: 0,
        })
        this.addControl('master_' + num + '_flash', {
            type: 'button',
            address: '/hog/hardware/flash/' + num,
	    tap: 1,
	    release: 0,
        })
    }
}

module.exports = {
    Application: Application,
}
