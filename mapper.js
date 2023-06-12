var nerdamer = require('./nerdamer-prime/nerdamer.core.js');
require('./nerdamer-prime/Algebra.js');
require('./nerdamer-prime/Calculus.js');
require('./nerdamer-prime/Solve.js');

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


const BANK_SIZE = 8;
const STRIP_TYPES = 159; // All but hidden and special, probably affects strip number interpretation?
const FEEDBACK = FB_STRIP_BUTTONS | FB_STRIP_VALUES | FB_MASTER | FB_SELECT_CHANNEL;
const FADER_MODE = 2; // Fader feedback uses both dB and fader position
const SEND_PAGE_SIZE = 8; // TODO
const PLUGIN_PAGE_SIZE = 8; // TODO


// This defines the mappings from the midi surface to ardour (and the
// reverse is automatically used for feedback).
mappings = {
    'xtouch': [
        // This particular mapping is for the x-touch in MIDI mode (not
        // MC mode - then it does not map all of its controls).
        // TODO: Check/document if this is the default X-touch MIDI mapping, or
        // a modified one.
        // TODO: Switch faders to pitch mode to have more granularity
        // prevent rounding on feedback?
        {
            // Master fader
            'from': ['/control', 1, 9, 'v'],
            'to': ['/master/fader', 'v / 127'],
        },
        {
            // Channel faders
            'from': ['/control', 1, 'c', 'v'],
            'to': ['/strip/fader', 'c', 'v / 127'],
            'if': ['c => 1', 'c <= 8'],
        },
        {
            // TODO: Feedback for coniditional mappings
            // Channel rotaries
            'from': ['/control', 1, 'c+9', 'v * 127'],
            'to': ['/strip/trimdB', 'c', 'v * 40 - 20'],
            'if': ['c => 1', 'c <= 8', 'channel_mode == TRIM'],
        },
        {
            // Channel rotaries
            'from': ['/control', 1, 'c+9', 'v * 127'],
            // TODO: This seems to invert (0=R, 1=L)?
            'to': ['/strip/pan_stereo_position', 'c', 'v'],
            'if': ['c => 1', 'c <= 8', 'channel_mode == PAN'],
        },
        /*
        {
            // Extra rotaries
            'from': ['/control', 1, 'c+9', 'v'],
            'to': ['/strip/fader', 'c', 'v / 127'],
            'if': ['c => 9', 'c <= 16'],
        },
        */

        // EQ band 1
        {
            // TODO: Solicit feedback about plugin parameters, seems
            // that is a bit tricky - only works for a single "selected"
            // plugin using `/select/plugin` (or
            // `/select/plugin/parameter`), and then omits the plugin id
            // from the /select/plugin/parameter messages... OTOH,
            // changing the below mappings to just select the EQ plugin
            // when setting detail_mode and then omitting the plugin
            // index from the mappings below should make it work
            // directly maybe?
            //
            // Or maybe ignore feedback, but then these must become
            // relative encoders instead of absolute
            // Gain
            'from': ['/control', 1, '9+9', 'v'],
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 17, 'v / 127'],
            'if': ['detail_mode == EQ_BAND_1_2'],
        },
        {
            'from': ['/control', 1, '11+9', 'v'],
            // BW
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 16, 'v / 127'],
            'if': ['detail_mode == EQ_BAND_1_2'],
        },
        {
            // Freq
            'from': ['/control', 1, '13+9', 'v'],
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 15, 'v / 127'],
            'if': ['detail_mode == EQ_BAND_1_2'],
        },
        {
            // Enable
            'from': ['/note', 1, '9-1', 127], // 127 = press, 0 = release
            // TODO: Sending a value that is not 0 or 1 seems to toggle,
            // but is this elegant?
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 14, 0.5],
            'if': ['detail_mode == EQ_BAND_1_2'],
        },

        // EQ Band 2
        {
            // Gain
            'from': ['/control', 1, '10+9', 'v'],
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 21, 'v / 127'],
            'if': ['detail_mode == EQ_BAND_1_2'],
        },
        {
            'from': ['/control', 1, '12+9', 'v'],
            // BW
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 20, 'v / 127'],
            'if': ['detail_mode == EQ_BAND_1_2'],
        },
        {
            // Freq
            'from': ['/control', 1, '14+9', 'v'],
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 19, 'v / 127'],
            'if': ['detail_mode == EQ_BAND_1_2'],
        },
        {
            // Enable
            'from': ['/note', 1, '10-1', 127], // 127 = press, 0 = release
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 18, 0.5],
            'if': ['detail_mode == EQ_BAND_1_2'],
        },

        // EQ band 3
        {
            // Gain
            'from': ['/control', 1, '9+9', 'v'],
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 25, 'v / 127'],
            'if': ['detail_mode == EQ_BAND_3_4'],
        },
        {
            'from': ['/control', 1, '11+9', 'v'],
            // BW
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 24, 'v / 127'],
            'if': ['detail_mode == EQ_BAND_3_4'],
        },
        {
            // Freq
            'from': ['/control', 1, '13+9', 'v'],
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 23, 'v / 127'],
            'if': ['detail_mode == EQ_BAND_3_4'],
        },
        {
            // Enable
            'from': ['/note', 1, '9-1', 127], // 127 = press, 0 = release
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 22, 0.5],
            'if': ['detail_mode == EQ_BAND_3_4'],
        },

        // EQ Band 4
        {
            // Gain
            'from': ['/control', 1, '10+9', 'v'],
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 29, 'v / 127'],
            'if': ['detail_mode == EQ_BAND_3_4'],
        },
        {
            'from': ['/control', 1, '12+9', 'v'],
            // BW
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 28, 'v / 127'],
            'if': ['detail_mode == EQ_BAND_3_4'],
        },
        {
            // Freq
            'from': ['/control', 1, '14+9', 'v'],
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 27, 'v / 127'],
            'if': ['detail_mode == EQ_BAND_3_4'],
        },
        {
            // Enable
            'from': ['/note', 1, '10-1', 127], // 127 = press, 0 = release
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 26, 0.5],
            'if': ['detail_mode == EQ_BAND_3_4'],
        },

        {
            // TODO: Feedback for mode buttons?
            // << button
            'from': ['/note', 1, 49, 127], // 127 = press, 0 = release
            'set': {'detail_mode': 'EQ_LOW_CUT_SHELF'},
        },
        {
            // << button
            'from': ['/note', 1, 50, 127], // 127 = press, 0 = release
            'set': {'detail_mode': 'EQ_HIGH_CUT_SHELF'},
        },
        {
            // LOOP button
            'from': ['/note', 1, 51, 127], // 127 = press, 0 = release
            'set': {'detail_mode': 'EQ_BAND_1_2'},
        },
        {
            // REC button
            'from': ['/note', 1, 52, 127], // 127 = press, 0 = release
            'set': {'detail_mode': 'EQ_BAND_3_4'},
        },

        // EQ global enable
        {
            'from': ['/note', 1, '15-1', 127], // 127 = press, 0 = release
            'to': ['/select/plugin/parameter', 'EQ_PLUGIN_IDX', 1, 'v / 127'],
            // TODO if?
        },

        {
            // Extra rotary 9 button
            'from': ['/note', 1, 8, 127], // 127 = press, 0 = release
            'set': {'channel_mode': 'TRIM'},
        },
        {
            // Extra rotary 11 button
            'from': ['/note', 1, 10, 127], // 127 = press, 0 = release
            'set': {'channel_mode': 'PAN'},
        },
    ]
}

// These are constants that are usable in all mapping expressions or
// variable assignments.
constants = {
    'TRIM': 0,
    'PAN': 1,
    'EQ_PLUGIN_IDX': 1,
    'COMP_PLUGIN_IDX': 1,
    'EQ_LOW_CUT_SHELF': 0,
    'EQ_BAND_1_2': 1,
    'EQ_BAND_3_4': 2,
    'EQ_HIGH_CUT_SHELF': 3,

}

// Define global_vars here with default values, these can be changed in
// 'set' clauses in mappings.
global_vars = {
    'channel_mode': 'TRIM',
    'detail_mode': 'EQ_BAND_1_2',
}

var send_host, send_port

// Shorthand for osc sending to ardour
to_ardour = (address, ...args) => {
    send(send_host, send_port, address, ...args)
}

to_surface = (name, address, ...args) => {
    send('midi', name, address, ...args)
}

plugin_info = {}

// Parameters are 1-based
describe_plugin = (strip, plugin) => {
    plugin_info[strip + "__" + plugin] = {}
    to_ardour('/strip/plugin/descriptor', strip, plugin)
    //to_ardour('/strip/plugin/descriptor', {'type': 'i', 'value': strip}, 'type': plugin)
}


process_mapping = (control, input_key, output_key, address, args) => {
    // This maps "from" into "to" for input, and the reverse for feedback
    input = control[input_key]
    output = control[output_key]
    set = control['set']
    conditions = control['if']

    if (!input) {
        // This is for feedback of rules that only set variables
        //console.debug("Mapping has no input defined, skipping rule", input_key, control)
        return
    }

    if (input[0] != address) {
        //console.debug("Control does not match message", control, address)
        return;
    }

    if (args.length != input.length - 1) {
        console.warn('(WARNING) Argument length mismatch, skipping rule', input, args)
        return
    }

    // Collect all expressions with variables to solve them as a system
    // of linear equations, and check expressions without variables
    // against the argument list directly
    let equations = []
    for (let i = 0; i < args.length; i++) {
        // TODO: Subs global vars
        expr = nerdamer(input[i + 1])
        if (expr.variables().length) {
            equations.push(expr.equals(nerdamer(args[i].value)))
        } else if (!expr.eq(args[i].value)) {
            //console.debug("Args did not match", i, args, input);
            return
        }
    }

    let vars = {...global_vars}

    if (equations.length) {
        let solution;
        try {
            // Slice to pass a copy
            solution = nerdamer.solveEquations(equations.slice());
        } catch (error) {
            console.error("Failed to solve equations", error['message'], args, input, equations);
            return
        }

        // Result is a nested array when there are multiple variables,
        // but a flat [name, value] array if there is just one
        if (!Array.isArray(solution[0]))
            solution = [solution]

        for (let [name, val] of solution) {
            if (name in vars){
                console.error("Multiple values for variable", name, input)
                return
            }
            vars[name] = val
        }
    }

    // Evaluate all given conditions against the global variables, and
    // the equation solution
    if (conditions) {
        for (c of conditions) {
            try {
                if (nerdamer(c, vars).eq(0)) {
                    //console.debug("Condition not matched", control, c, vars)
                    return
                }
            } catch (error) {
                console.error("Failed to evaluate condition", error['message'], control, c, vars)
                return
            }
        }
    }

    // If we end up here, we need to activate this mapping
    console.debug("Processing mapping", control)

    // Process "set" commands, but only on surface->ardour, not on
    // the feedback route (if any)
    if (set && input_key == 'from') {
        for (const [key, value] of Object.entries(set)) {
            if (!(key in global_vars)) {
                console.error("Cannot create new variable in set clause", key, control)
                return
            }
            // TODO: Use nerdamer.setVar? Tracking explicitly makes it
            // easier to see original constants, and prevent shadowing
            // globals, so maybe this is better?
            global_vars[key] = value;
        }
    }

    // Process the output OSC command
    if (output) {
        result = [output[0]];
        for (let i = 1; i < output.length; i++) {
            try {
                // toDecimal forces a non-exact representation, but returns
                // a string instead of a float, so parse...
                let value = parseFloat(nerdamer(output[i], vars).toDecimal())
                result.push(value)
            } catch (error) {
                console.error("Failed to evaluation argument", error['message'], args, input, output[i]);
                return
            }
        }

        return result
    }
}

module.exports = {

    oscInFilter: function(data) {

        var {address, args, host, port} = data

	console.log("IN", address, args, host, port);

        // Control surface input
	if (host === "midi") {
            controls = mappings[port];
            if (controls) {
                for (const c of controls) {
                    result = process_mapping(c, 'from', 'to', address, args)
                    if (result) {
                            to_ardour(...result)
                    }
                }
            } else {
                console.warning("Unknown source:", host, port)
            }
	}

	// Feedback from Ardour
	if (host == send_host && port == send_port) {
            console.log("From Ardour");
            for (p in mappings) {
                controls = mappings[p]
                for (const c of controls) {
                    result = process_mapping(c, 'to', 'from', address, args)
                    if (result) {
                        to_surface(p, ...result)
                    }
                }
            }

            // This just collects and prints plugin info if requested
            // with a manual describe_plugin() call in init()
            if (address == '/strip/plugin/descriptor') {
                // TODO: Number of scale points, scale points and
                // current value are not parsed
                let [strip, plugin, param, name, flags, dataType, min, max, unit] = args.map((a) => a.value)
                plugin_info[strip + "__" + plugin][param] = {param, name, flags, dataType, min, max, unit}
            } else if (address == '/strip/plugin/descriptor_end') {
                let [strip, plugin] = args.map((a) => a.value)
                console.log(strip, plugin)
                idx = 1
                for ([id, info] of Object.entries(plugin_info[strip + "__" + plugin])) {
                    // Print index to use in plugin/parameter message
                    msg = `id ${id}`
                    let controllable = (info.flags & (1 << 7))
                    if (controllable) {
                        msg += `, idx ${idx}`
                        ++idx;
                    } else {
                        msg += `, not_ctrlable`
                    }

                    msg += `: ${info.name}, ${info.min}-${info.max}, unit ${info.unit}, type ${info.dataType}, flags ${info.flags}`

                    console.log(msg)
                }
            }
	}

        // TODO: What to pass through to client?
        return {address, args, host, port}

    },

    /*
    oscOutFilter: function(data) {

        var {address, args, host, port} = data
	console.log("OUT", address, args, host, port);

        return {address, args, host, port}

    }
    */

    // This is called whenever the module is loaded, so on startup
    // (before init()) and then whenever the module is autoreloaded.
    // This should set up any javascript state (which is discarded on
    // autoreload).
    init_reload: () => {
        if (settings.read('send')) {
            [send_host, send_port] = settings.read('send')[0].split(':')
        } else {
            console.warn('(WARNING) "send" option not set')
        }

        for (const [key, value] of Object.entries(constants)) {
            nerdamer.setConstant(key, value)
        }
    },

    // This is called once on startup by open-stage-control after the
    // OSC connection is set up. This should send startup OSC commands
    // to initialize the connection. It is not called again when the
    // module is reloaded, so any javascript state should be set up in
    // init_reload()
    init: () => {
        to_ardour("/set_surface",
                  BANK_SIZE,
                  STRIP_TYPES,
                  FEEDBACK,
                  FADER_MODE,
                  SEND_PAGE_SIZE,
                  PLUGIN_PAGE_SIZE,
        );

        // Uncomment this to get parameter descriptions for a plugin,
        // passing strip and plugin indices (1-based)
        // describe_plugin(3, 1)

        //module.exports['oscInFilter']({'address': '/pitch', 'args': [ { type: 'i', value: 9 }, { type: 'i', value: 15792 } ], 'host': 'midi', 'port': 'xtouch'});
        //console.log(nerdamer.solveEquations(['dummy=1', 'dummy1>0']))
        //console.log(parseFloat(nerdamer('v / 100', {'v': 10}).toString()))
        //console.log(nerdamer('(v > 10) * (v > 2)', {'v': 10}).toDecimal())
        //console.log(nerdamer('c').equals(nerdamer(1)))
        //console.log(nerdamer.solveEquations(['dummy=1', 'c=2', nerdamer('d').equals(nerdamer(2))]))
        //console.log(nerdamer('1').variables())
        //console.log(nerdamer('(v => 11)', {'v': 10}).toDecimal())
    },
}

module.exports.init_reload()
