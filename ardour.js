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
# TODO: Can FB_OSC_1_REPLY be omitted now https://github.com/Ardour/ardour/pull/900 is merged? Older notes suggest so, but I now no longer understand why?
const FEEDBACK = FB_STRIP_BUTTONS | FB_STRIP_VALUES | FB_MASTER | FB_SELECT_CHANNEL | FB_OSC_1_REPLY | FB_ALL_PLUGINS
const FADER_MODE = 2 // Fader feedback uses both dB and fader position
const SEND_PAGE_SIZE = 0 // TODO
const PLUGIN_PAGE_SIZE = 0 // TODO

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
        this.init_is_complete = false
        this.selected_plugin_id = undefined
    }

    reload() {
        this.init()
    }

    init() {
        this.send("/set_surface",
                  BANK_SIZE,
                  STRIP_TYPES,
                  FEEDBACK,
                  FADER_MODE,
                  SEND_PAGE_SIZE,
                  PLUGIN_PAGE_SIZE,
        );
        this.initControls()
    }

    send(address, ...args) {
        if (address == '/select/plugin/parameter' && args.length == 3) {
            // This translates a fake message using plugin/parameter
            // slugs into the corresponding ids for the current strip
            let [plugin_slug, param_slug, value] = args
            let plugin = Object.values(this.plugin_info[this.selected_strip_ssid]).find((info) => info.slug == plugin_slug)
            if (plugin === undefined) {
                console.warn("Unknown plugin in outgoing message", address, args)
                return
            }
            let param = Object.values(plugin.input_params).find((info) => info.slug == param_slug)
            if (param === undefined) {
                console.warn("Unknown plugin parameter in outgoing message", address, args)
                return
            }
            args = [plugin.plugin_id, param.input_param_id, value]
            // TODO: This message with a plugin_id specified will change
            // the selected plugin and solicit feedback, which we should track
        }
        super.send(address, ...args)
    }

    processMessage(address, args) {
        if (address == '/reply') {
            // Process /strip/list reply, info about a single strip
            //
            // The /reply message is used as a reply to /strip/list and
            // to /#current_value, Since we only use the former, assume
            // this is a strip list reply.
            // Note that by default, Ardour sends #reply, but that is
            // not valid OSC 1.0 (apparently it is a draft OSC 1.1
            // feature) and is rejected by open-stage-control, so we
            // configure FB_OSC_1_REPLY to get /reply instead of #reply.
            // Example: { address: '/reply', args: [ 'AT', 'Audio 26', 1, 2, 0, 1, 26, 1 ] }
            if (args[0].value == 'end_route_list') {
                // Nothing to do
            } else {
                let [type, name, num_inputs, num_outputs, mute, solo, ssid, recenable] = args.map((a) => a.value)
                this.addControlsForStrip(ssid)
                var request_plugins
                switch(type) {
                    case 'AT': // Audio track
                    case 'MT': // Midi track
                        request_plugins = true
                        break;

                    case 'B': // Audio bus
                    case 'MB': // Midi bus
                    case 'FB': // Foldback bus
                    case 'V': // VCA
                        // Buses can have plugins, but /strip/plugin/list does not work on them
                        // (because Ardour's OSC::route_plugin_list function only works on Route
                        // objects, this might be an ardour bug)
                        request_plugins = false
                        break;
                }

                this.strip_info[ssid] = {ssid, type, name, plugin_list_complete: !request_plugins}
                if (request_plugins) {
                    // TODO: This does not seem to work on reload?
                    this.send("/strip/plugin/list", ssid)
                }
            }
        } else if (address == '/strip/plugin/list') {
            // Process /strip/plugin/list reply, info about a single plugin
            //
            // Example {address: '/strip/plugin/list', args: [ 1, 1, 'ACE EQ', 1, 2, 'ACE Compressor', 1, 3, 'ACE Reverb', 1 ] }
            if ((args.length - 1) % 3 != 0) {
                console.warn("Unexpected number of arguments", address, args)
            } else {
                let values = args.map((a) => a.value)
                let ssid = values.shift()
                this.plugin_info[ssid] = {}
                while (values.length) {
                    let [plugin_id, plugin_name, plugin_active] = [values.shift(), values.shift(), values.shift()]

                    // Request more details
                    this.plugin_info[ssid][plugin_id] = {
                        plugin_id: plugin_id,
                        name: plugin_name,
                        slug: util.slugify(plugin_name),
                        params: {},
                        input_params: {},
                        complete: false,
                    }
                    this.send('/strip/plugin/descriptor', ssid, plugin_id)
                }
                this.strip_info[ssid].plugin_list_complete = true
                this.checkPluginInfoComplete()
            }
        } else if (address == '/strip/plugin/descriptor') {
            // Process /strip/plugin/descriptor reply, info about a single plugin parameter
            //
            // TODO: Number of scale points, scale points and
            // current value are not parsed
            let [ssid, plugin_id, param_id, name, flags, dataType, min, max, unit] = args.map((a) => a.value)
            let slug = util.slugify(name)
            let plugin = this.plugin_info[ssid][plugin_id]

            // Based on OSC::route_plugin_descriptor() in ardour source
            const enumeration = (flags & 1)
            const integer_step = (flags & 2)
            const logarithmic = (flags & 4)
            const sr_dependent = (flags & 32)
            const toggled = (flags & 64)
            const is_input = (flags & 128)

            let info = {param_id, name, slug, flags, dataType, min, max, unit}
            plugin.params[param_id] = info
            if (is_input) {
                // Only controllable params have osc messages, and the index
                // to use in messages is the index in this list
                let input_param_id = Object.entries(plugin.input_params).length + 1
                plugin.input_params[input_param_id] = info
                info.input_param_id = input_param_id

                // Ardour only sends feedback for the selected control based
                // on plugin and parameter numbers (which might change
                // meaning depending on the selected channel. This control
                // matches fake messages produced by tracking the selected
                // plugin and translating the ids to slugs.
                const fake_control_id = `plugin_${plugin.slug}_param_${slug}`
                // Only add once - shared among different strips
                if (!(fake_control_id in this.controls)) {
                    // This is also how ardouer internally detects
                    // toggle/switch plugin parameters
                    if (integer_step && min == 0 && max == 1) {
                        this.addControl(fake_control_id, {
                            type: 'button',
                            address: '/select/plugin/parameter',
                            preArgs: [plugin.slug, slug],
                        })
                    } else {
                        this.addControl(fake_control_id, {
                            type: 'fader',
                            address: '/select/plugin/parameter',
                            preArgs: [plugin.slug, slug],
                            range: {"min": 0, "max": 1},
                        })
                    }
                }
                info.control_id = fake_control_id
            }
            /*
            // These controls match the original messages (which exclude
            // the plugin id, which is implied to be the currently
            // selected plugin
            const control_id = `plugin_selected_param_${param_id}`
            // Only add once - shared among different strips
            if (!(control_id in this.controls)) {
                this.addControl(control_id, {
                    type: 'fader',
                    address: '/select/plugin/parameter',
                    preArgs: [param_id],
                    range: {"min": 0, "max": 1},
                })
                this.addControl(`plugin_selected_param_${param_id}_name`, {
                    type: 'string',
                    address: '/select/plugin/parameter/name',
                    preArgs: [param_id],
                })
            }
            */
        } else if (address == '/strip/plugin/descriptor_end') {
            // Process end of /strip/plugin/descriptor replies
            let [ssid, plugin_id] = args.map((a) => a.value)
            console.debug(`Parameters for ssid=${ssid}, plugin_id=${plugin_id}, name=${this.plugin_info[ssid][plugin_id].name}`)
            for (let [id, info] of Object.entries(this.plugin_info[ssid][plugin_id].params)) {
                console.debug(`id ${id}, input_id ${info.plugin_idx ?? 'not_input'}: ${info.name}, ${info.min}-${info.max}, unit ${info.unit}, type ${info.dataType}, flags ${info.flags}`)
            }
            this.plugin_info[ssid][plugin_id].complete = true
            this.checkPluginInfoComplete()
        /*
        } else if (address == '/select/plugin/name') {
            // Process change in selected plugin
            //
            // We only get the name of the selected plugin, not its
            // index, so this uses a list with indices of expected
            // plugin changes to match against the name so this could
            // work even when the same plugin is used twice in a single
            // strip
            //
            // Do not processing if init is not complete, that would be
            // fragile with plugin_info still incomplete
            if (!this.init_is_complete) {
                console.debug("Ignoring plugin change, init not complete yet", address, args)
            } else {
                let name = args[0].value
                let expected_id = this.expected_plugin_changes.shift()
                let matches_current_plugin = false
                if (this.selected_strip_ssid !== undefined && this.selected_plugin_id !== undefined) {
                    let current_plugin = this.plugin_info[this.selected_strip_ssid][this.selected_plugin_id]
                    // This can be undefined if we switched to
                    // a different strip that has fewer plugins
                    if (current_plugin === undefined) {
                        console.debug("Selected plugin index not defined in current strip, clearing", args, address)
                        this.selected_plugin_id = undefined
                    } else {
                        matches_current_plugin = (current_plugin.name == name)
                    }
                }
                if (expected_id === undefined) {
                    if (!matches_current_plugin) {
                        console.warn("Unexpected plugin selection change (none expected)", address, args)
                        this.selected_plugin_id = undefined
                        // TODO: Try to reset selected plugin id?
                    } else {
                        // Sometimes ardour sends extra plugin "changes" for
                        // the current plugin, so just ignore those
                        console.warn("Unexpected plugin selection update (but matches current plugin)", address, args)
                    }
                } else {
                    let expected_name = this.plugin_info[this.selected_strip_ssid][expected_id].name
                    if (name == expected_name) {
                        //console.debug(`Plugin selection changed to id=${expected_id}, name=${name}`, address, args)
                        this.selected_plugin_id = expected_id
                        console.warn(`Expected plugin selection change "${name}"`, address, args)
                    } else {
                        if (!matches_current_plugin) {
                            console.warn(`Unexpected plugin selection change (changed to "${name}", expected "${expected_name}", dropping expectations`, address, args)
                            // Flush expectations, so expectations and reality
                            // can be resynced at some point
                            this.expected_plugin_changes = []
                            this.selected_plugin_id = undefined
                            // TODO: Try to reset selected plugin id?
                        } else {
                            console.warn(`Unexpected plugin selection update (matches current plugin, but expected "${expected_name}"`, address, args)
                        }
                    }
                }

                // If we are done iterating over plugins to get their
                // values, select the plugin that we want to select
                if (this.selected_plugin_id !== undefined && this.expected_plugin_changes.length == 0) {
                    this.trySelectPlugin()
                }
            }
        } else if (address == '/select/plugin/parameter') {
            // Process plugin parameter feedback
            //
            // Since we only get feedback for the selected plugin, but
            // we want to provide controls for specific named plugins as
            // well, this maps the message based on the currently
            // selected plugin.

            // Do not processing if init is not complete, that would be
            // fragile with plugin_info still incomplete
            if (!this.init_is_complete) {
                console.debug("Ignoring plugin parameter value, init not complete yet", address, args)
            } else {
                let result = false
                // Only if we do not expect further plugin changes, process the
                // original message (this prevents the values of the
                // generic selected plugin controls to change value all the
                // time while iterating over all plugins
                if (this.expected_plugin_changes.length == 0)
                    result ||= super.processMessage(address, args)

                if (this.selected_plugin_id !== undefined) {
                    let [input_param_id, value] = args.map((a) => a.value)
                    let plugin = this.plugin_info[this.selected_strip_ssid][this.selected_plugin_id]
                    let param = plugin.input_params[input_param_id]
                    // This might be undefined if we did not get plugin
                    // details yet, but also when switching to a channel or
                    // plugin that does not have this parameter, then ardour
                    // will send zero values
                    if (param !== undefined) {
                        // This produces a fake message with the plugin and
                        // param names, so we can reuse the existing
                        // address-matching logic and route this message to the
                        // right controls
                        result ||= super.processMessage(address, [{value: plugin.slug}, {value: param.slug}, {value: value}])
                    }
                }
                return result
            }
        */
        } else if (address == '/select/plugin/parameter') {
            // Process plugin parameter feedback
            //
            // Do not processing if init is not complete, that would be
            // fragile with plugin_info still incomplete
            if (!this.init_is_complete) {
                console.debug("Ignoring plugin parameter value, init not complete yet", address, args)
            } else {
                let result = false

                // Process teh original message (with integer plugin and
                // parameter ids)
                result ||= super.processMessage(address, args)

                let [piid, paid, value] = args.map((a) => a.value)
                // plugin and param might be undefined when switching to
                // a channel that does not have this plugin or
                // parameter, then ardour will send zero values to clear
                // existing controls.
                let plugin = this.plugin_info[this.selected_strip_ssid][piid]
                if (plugin !== undefined) {
                    let param = plugin.input_params[paid]
                    if (param !== undefined) {
                        // This produces a fake message with the plugin and
                        // param names, so we can reuse the existing
                        // address-matching logic and route this message to the
                        // right controls
                        result ||= super.processMessage(address, [{value: plugin.slug}, {value: param.slug}, {value: value}])
                    }
                }
                return result
            }
        } else if (address == '/strip/select') {
            // Process selected strip change
            let [ssid, selected] = args.map((a) => a.value)

            if (selected) {
                if (this.selected_strip_ssid == ssid) {
                    console.debug("Selected strip changed to same value as before", ssid)
                } else {
                    console.debug("Selected strip changed to", ssid)
                    // Clear values for plugins no longer present in new strip
                    if (this.init_is_complete && this.selected_strip_ssid !== undefined) {
                        for (let plugin of Object.values(this.plugin_info[this.selected_strip_ssid])) {
                            let new_strip_plugin = Object.values(this.plugin_info[ssid]).find((info) => info.slug == plugin.slug)
                            if (new_strip_plugin === undefined) {
                                for (let param of Object.values(plugin.input_params)) {
                                    this.getControl(param.control_id).processValue(0)
                                }
                            }
                        }
                    }
                    this.selected_strip_ssid = ssid
                    //if (this.init_is_complete)
                    //    this.requestStripPluginValues()
                }
            }
            // Also let regular control match this message
            super.processMessage(address, args)
        } else {
            return super.processMessage(address, args)
        }

        // Handled message
        return true
    }

    initControls() {
        // TODO: For some reason requesting the list of strips on
        // startup does not work right away... Ardour simply does not
        // reply (it works on reload, but apply the timeout then as
        // well for simplicity)
        let self = this
        setTimeout(() => { self.send("/strip/list") }, 1000)

        /*
        // This controls the intended selected plugin. It might not
        // actually reflect the actually selected plugin, in case the
        // currently selected strip does not have the intended plugin.
        this.addControl('intended_selected_plugin', {
            type: 'string',
            onSend: (value) => this.trySelectPlugin(value),
        })
        */
    }

    checkPluginInfoComplete() {
        const all_plugins_lists_complete = Object.values(this.strip_info).every((info) => info.plugin_list_complete)
        const all_plugin_info_complete = Object.values(this.plugin_info).every((plugins) => Object.values(plugins).every((info) => info.complete))
        console.log( "Maybe complete?", this.strip_info, all_plugin_info_complete )
        if (all_plugins_lists_complete && all_plugin_info_complete) {
            console.info("Processed all plugin info")
            this.finalizeInit()
        }

    }

    finalizeInit() {
        // Re-select current strip to trigger plugin value
        // feedback (now that we created controls for them)
        if (this.selected_strip_ssid) {
            // For some reason we need to send a 0 value to select
            // a strip, a 1 does not work. Feedback is 0/1 as expected.
            // https://tracker.ardour.org/view.php?id=9732
            this.send('/strip/select', this.selected_strip_ssid, 0)
        }

        //this.requestStripPluginValues()

        console.info("Calling init_complete_callback")
        this.init_is_complete = true
        this.init_complete_callback()
    }

    /*
    trySelectPlugin(slug) {
        if (slug === undefined) {
            slug = this.getControl('intended_selected_plugin').value
        }
        console.debug(`trySelectPlugin: Trying to select plugin ${slug} on strip ${this.selected_strip_ssid}`)
        if (this.selected_strip_ssid !== undefined && slug !== undefined) {
            let plugins = Object.values(this.plugin_info[this.selected_strip_ssid])
            let plugin = plugins.find((info) => info.slug == slug)
            if (plugin === undefined) {
                console.debug(`trySelectPlugin: Selected strip (${this.selected_strip_ssid}) does not have intended plugin {${slug})`)
            } else if (this.selected_plugin_id === undefined) {
                console.debug(`trySelectPlugin: Current plugin is unknown, forcing switch to first plugin first`)
                // Once this is processed, we will be called again
                this.send('/select/plugin', -999)
                this.expected_plugin_changes.push(1)
            } else if (plugin.plugin_id == this.selected_plugin_id) {
                console.debug(`trySelectPlugin: Selected strip (${this.selected_strip_ssid}) already has intended plugin selected {${slug} at id ${plugin.plugin_id})`)
            } else {
                this.send('/select/plugin', plugin.plugin_id - this.selected_plugin_id)
                this.expected_plugin_changes.push(plugin.plugin_id)
            }
        }
    }

    requestStripPluginValues() {
        let ssid = this.selected_strip_ssid
        if (ssid === undefined) {
            console.warn("Cannot request plugin values, selected strip is unknown")
            return
        }
        let info = this.plugin_info[ssid]

        if (info == undefined) {
            console.warn(" strip that has no info (yet?)", ssid)
            return
        }

        if (this.plugin_values_for_strip == ssid) {
            console.info(`Already have plugin values for strip ${ssid}, not requesting again`)
            return
        }
        this.plugin_values_for_strip = ssid

        let num_plugins = Object.keys(info).length

        if (num_plugins > 0) {
            // We can only select plugins with a delta and when the selected
            // strip changes the selected plugin might also change (because
            // the new strip has fewer plugins for example), so this seems
            // to be the only way to get to a known selected plugin (the
            // first).
            this.send('/select/plugin', -999)
            this.expected_plugin_changes.push(1)
            // TODO: It seems that if this is done after a strip
            // selection change, the plugins of the previously selected
            // strip are enumerated instead of the new one... After the
            // full resync is processed, then we do get the right
            // plugin sync, so maybe we should wait for that?

            // Then iterate all plugins to solicit feedback
            for (let i = 2; i <= num_plugins; i++) {
                this.send('/select/plugin', 1)
                this.expected_plugin_changes.push(i)
            }
        }
        // TODO: Clear values for plugins not in current strip?
    }
    */

    addControlsForStrip(ssid) {
        let self = this

        this.addControl('strip_' + ssid + '_fader', {
            type: 'fader',
            address: '/strip/fader',
            preArgs: [ssid],
            range: {"min": 0, "max": 1},
        })
        this.addControl('strip_' + ssid + '_gain', {
            type: 'fader',
            address: '/strip/gain',
            preArgs: [ssid],
            range: {"min": -193, "max": 6},
        })
        this.addControl('strip_' + ssid + '_trim', {
            type: 'fader',
            address: '/strip/trimdB',
            preArgs: [ssid],
            range: {"min": -20, "max": 20},
        })
        // TODO: 0 is right, 1 is left? That is counterintuitive
        this.addControl('strip_' + ssid + '_pan', {
            type: 'fader',
            address: '/strip/pan_stereo_position',
            preArgs: [ssid],
            range: {"min": 0, "max": 1},
        })
        this.addControl('strip_' + ssid + '_mute', {
            type: 'button',
            address: '/strip/mute',
            preArgs: [ssid],
        })
        this.addControl('strip_' + ssid + '_solo', {
            type: 'button',
            address: '/strip/solo',
            preArgs: [ssid],
        })
        this.addControl('strip_' + ssid + '_select', {
            type: 'button',
            address: '/strip/select',
            preArgs: [ssid],
            // For some reason we need to send a 0 value to select
            // a strip, a 1 does not work. Feedback is 0/1 as expected.
            // https://tracker.ardour.org/view.php?id=9732
            tap: 0,
        })
        this.addControl('strip_' + ssid + '_name', {
            type: 'text',
            address: '/strip/name',
            preArgs: [ssid],
        })
    }
}

// These are constants that are usable in all mapping expressions or
// variable assignments.
var constants = {
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
var global_vars = {
    'channel_mode': 'TRIM',
    'detail_mode': 'EQ_BAND_1_2',
}


module.exports = {
    Application: Application,
}
