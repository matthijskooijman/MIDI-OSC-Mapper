"use strict";

// Prevent xtouch.js from creating widgets
global.surface_no_init = 1

var core = require('./core.js')
var xtouch = require('./xtouch.js')
var ardour = require('./ardour.js')
var util = require('./util.js')

var bank = 0

// These are predefined by open-stage-control. Declare them again to
// prevent tsserver check errors. Assigning them from global.something
// (which are just the same variables) to prevent "possibly 'undefined'"
// errors.
var send = send
var receive = receive
var app = app
var settings = settings

class DetailMode {
    static EQ_LOW_CUT_SHELF = 0
    static EQ_BAND_1_2 = 1
    static EQ_BAND_3_4 = 2
    static EQ_HIGH_CUT_SHELF = 3
}

class ChannelEncoderMode {
    static TRIM = 0
    static PAN = 1
}

function change_detail_mode(mode) {
    console.debug("Setting detail_mode=" + util.enumLookup(DetailMode, mode))

    /*
    const links = {
        [DetailMode.EQ_BAND_1_2]: {
            'aux_encoder_9':         [17, "Band 1\ngain"],
            'aux_encoder_11':        [16, "Band 1\nBW"],
            'aux_encoder_13':        [15, "Band 1\nFreq"],
            'aux_encoder_button_9':  [14, "Band 1\nenable"],

            'aux_encoder_10':        [21, "Band 2\ngain"],
            'aux_encoder_12':        [20, "Band 2\nBW"],
            'aux_encoder_14':        [19, "Band 2\nFreq"],
            'aux_encoder_button_10': [18, "Band 2\nenable"],
        },
        [DetailMode.EQ_BAND_3_4]: {
            'aux_encoder_9':         [25, "Band 3\ngain"],
            'aux_encoder_11':        [24, "Band 3\nBW"],
            'aux_encoder_13':        [23, "Band 3\nFreq"],
            'aux_encoder_button_9':  [22, "Band 3\nenable"],

            'aux_encoder_10':        [29, "Band 4\ngain"],
            'aux_encoder_12':        [28, "Band 4\nBW"],
            'aux_encoder_14':        [27, "Band 4\nFreq"],
            'aux_encoder_button_10': [26, "Band 4\nenable"],
        },
    }

    application.setControlValue('intended_selected_plugin', 'x42_eq_parametric_equalizer_mono')

    for (let [id, [param_num, label]] of Object.entries(links[mode])) {
        application.addLink(`plugin_selected_param_${param_num}`,
           [xtouch_surface, id],
           [ui_surface, id, {widget: {html: `${label}: @{this.value}`}}],
        )
    }
    */

    const links = {
        [DetailMode.EQ_LOW_CUT_SHELF]: {
            'aux_encoder_9':         [undefined, "<br/><br/>"],
            'aux_encoder_11':        ['highpass_resonance', "Low cut<br/>Resonance"],
            'aux_encoder_13':        ['highpass_frequency', "Low cut<br/>Freq"],
            'aux_encoder_9_button':  ['highpass', "enable"],

            'aux_encoder_10':        ['lowshelf_gain', "Low shelf<br/>gain"],
            'aux_encoder_12':        ['lowshelf_bandwidth', "Low shelf<br/>BW"],
            'aux_encoder_14':        ['lowshelf_frequency', "Low shelf<br/>Freq"],
            'aux_encoder_10_button': ['lowshelf', "enable"],
        },
        [DetailMode.EQ_BAND_1_2]: {
            'aux_encoder_9':         ['gain_1', "Band 1<br/>gain"],
            'aux_encoder_11':        ['bandwidth_1', "Band 1<br/>BW"],
            'aux_encoder_13':        ['frequency_1', "Band 1<br/>Freq"],
            'aux_encoder_9_button':  ['section_1', "enable"],

            'aux_encoder_10':        ['gain_2', "Band 2<br/>gain"],
            'aux_encoder_12':        ['bandwidth_2', "Band 2<br/>BW"],
            'aux_encoder_14':        ['frequency_2', "Band 2<br/>Freq"],
            'aux_encoder_10_button': ['section_2', "enable"],
        },
        [DetailMode.EQ_BAND_3_4]: {
            'aux_encoder_9':         ['gain_3', "Band 3<br/>gain"],
            'aux_encoder_11':        ['bandwidth_3', "Band 3<br/>BW"],
            'aux_encoder_13':        ['frequency_3', "Band 3<br/>Freq"],
            'aux_encoder_9_button':  ['section_3', "enable"],

            'aux_encoder_10':        ['gain_4', "Band 4<br/>gain"],
            'aux_encoder_12':        ['bandwidth_4', "Band 4<br/>BW"],
            'aux_encoder_14':        ['frequency_4', "Band 4<br/>Freq"],
            'aux_encoder_10_button': ['section_4', "enable"],
        },
        [DetailMode.EQ_HIGH_CUT_SHELF]: {
            'aux_encoder_9':         [undefined, "<br/><br/>"],
            'aux_encoder_11':        ['lowpass_resonance', "High cut<br/>Resonance"],
            'aux_encoder_13':        ['lowpass_frequency', "High cut<br/>Freq"],
            'aux_encoder_9_button':  ['lowpass', "enable"],

            'aux_encoder_10':        ['highshelf_gain', "High shelf<br/>gain"],
            'aux_encoder_12':        ['highshelf_bandwidth', "High shelf<br/>BW"],
            'aux_encoder_14':        ['highshelf_frequency', "High shelf<br/>Freq"],
            'aux_encoder_10_button': ['highshelf', "enable"],
        },
    }

    const plugin = 'x42_eq_parametric_equalizer_mono'

    for (let [id, [param, label]] of Object.entries(links[mode])) {
        if (param === undefined) {
            xtouch_surface.unlink(id)
            ui_surface.unlink(id)
            ui_surface.setWidgetAttrs(id, {html: label})
        } else {
            let attrs = {}
            if (id.includes('button')) {
                attrs.label = label
            } else {
                // TODO: Show value in real units
                attrs.html = `${label}: @{this.value}`
                // TODO: Somewhere else? Should also apply to the
                // empty label set when unlinking
                attrs.css = ":host .html{ line-height: 15rem; }"
            }

            application.addLink(`plugin_${plugin}_param_${param}`,
                [xtouch_surface, id],
                [ui_surface, id, {widget: attrs}],
            )
        }
    }

    application.addLink(`plugin_${plugin}_param_enable`,
        [xtouch_surface, 'aux_encoder_15_button'],
        [ui_surface, 'aux_encoder_15_button', {widget: {
            label: 'EQ on',
        }}],
    )
    application.addLink(`plugin_${plugin}_param_gain`,
        [xtouch_surface, 'aux_encoder_15'],
        [ui_surface, 'aux_encoder_15', {widget: {
            html: 'EQ gain',
            css: ":host .html{ line-height: 15rem; }",
        }}],
    )
}

function setup_virtual_controls() {
    application.addControl('virtual_bank_up', {
        type: 'button',
        onSend: (value) => {change_bank(1)},
        tap: 1,
    })
    application.addControl('virtual_bank_down', {
        type: 'button',
        onSend: (value) => {change_bank(-1)},
        tap: 1,
    })
    application.addControl('virtual_detail_mode', {
        type: 'enum',
        values: DetailMode,
        onSend: (value) => change_detail_mode(value),
    })
    application.addControl('virtual_channel_encoder_mode', {
        type: 'enum',
        values: ChannelEncoderMode,
        onSend: (value) => change_bank(0),
    })
}

function setup_initial_links() {
    // TODO: Not duplicate the on_value here
    application.addLink('virtual_detail_mode',
       [xtouch_surface, 'control_button_1', {on_value: DetailMode.EQ_LOW_CUT_SHELF}],
       [ui_surface, 'control_button_1', {widget: {label: 'Lo cut/shelf'}, on_value: DetailMode.EQ_LOW_CUT_SHELF}],
    )
    application.addLink('virtual_detail_mode',
       [xtouch_surface, 'control_button_2', {on_value: DetailMode.EQ_HIGH_CUT_SHELF}],
       [ui_surface, 'control_button_2', {widget: {label: 'Hi cut/shelf'}, on_value: DetailMode.EQ_HIGH_CUT_SHELF}],
    )
    application.addLink('virtual_detail_mode',
       [xtouch_surface, 'control_button_3', {on_value: DetailMode.EQ_BAND_1_2}],
       [ui_surface, 'control_button_3', {widget: {label: 'Lo/Lo-mid'}, on_value: DetailMode.EQ_BAND_1_2}],
    )
    application.addLink('virtual_detail_mode',
       [xtouch_surface, 'control_button_4', {on_value: DetailMode.EQ_BAND_3_4}],
       [ui_surface, 'control_button_4', {widget: {label: 'Hi/Hi-mid'}, on_value: DetailMode.EQ_BAND_3_4}],
    )
    application.addLink('virtual_bank_down',
       [xtouch_surface, 'control_button_5'],
       [ui_surface, 'control_button_5', {widget: {label: 'Bank down'}}],
    )
    application.addLink('virtual_bank_up',
       [xtouch_surface, 'control_button_6'],
       [ui_surface, 'control_button_6', {widget: {label: 'Bank up'}}],
    )
    application.addLink('virtual_channel_encoder_mode',
       [xtouch_surface, 'channel_1_encoder_button', {on_value: ChannelEncoderMode.TRIM}],
       [ui_surface, 'channel_1_encoder_button', {widget: {label: 'Trim'}, on_value: ChannelEncoderMode.TRIM}],
    )
    application.addLink('virtual_channel_encoder_mode',
       [xtouch_surface, 'channel_2_encoder_button', {on_value: ChannelEncoderMode.PAN}],
       [ui_surface, 'channel_2_encoder_button', {widget: {label: 'Pan'}, on_value: ChannelEncoderMode.PAN}],
    )
    apply_bank(bank)
}

const BANK_SIZE = 8

// TODO: Limit bank top end
// TODO: Move banking into ardour.js?
function change_bank(delta) {
    bank += delta
    if (bank < 0)
        bank = 0
    apply_bank(bank)
}

function apply_bank(bank) {
    const channel_encoder_mode = application.getControlValue('virtual_channel_encoder_mode')
    console.debug(`Setting bank=${bank}, channel_encoder_mode=${channel_encoder_mode}`)

    for (let i = 0; i < BANK_SIZE; i++) {
        let surface_num = i + 1
        let app_num = bank * BANK_SIZE + i + 1

        // TODO: range steps / pips for faders, maybe logarithmic and use gain
        // instead of fader? And convert when linking to surface.
        application.addLink(`strip_${app_num}_fader`,
           [xtouch_surface, `channel_${surface_num}_fader`],
           [ui_surface, `channel_${surface_num}_fader`, {widget: {html: "@{this.value}"}}],
        )
        application.addLink(`strip_${app_num}_mute`,
           [xtouch_surface, `channel_${surface_num}_button_3`],
           [ui_surface, `channel_${surface_num}_button_3`, {widget: {label: "Mute"}}],
        )
        application.addLink(`strip_${app_num}_solo`,
           [xtouch_surface, `channel_${surface_num}_button_2`],
           [ui_surface, `channel_${surface_num}_button_2`, {widget: {label: "Solo"}}],
        )
        application.addLink(`strip_${app_num}_select`,
           [xtouch_surface, `channel_${surface_num}_button_select`],
           [ui_surface, `channel_${surface_num}_button_select`, {widget: {label: `Select\n\n@{channel_${surface_num}_name.value}`}}],
        )
        application.addLink(`strip_${app_num}_name`,
           [ui_surface, `channel_${surface_num}_name`],
        )
        switch(channel_encoder_mode) {
            case ChannelEncoderMode.TRIM:
                application.addLink(`strip_${app_num}_trim`,
                   [xtouch_surface, `channel_${surface_num}_encoder`],
                   [ui_surface, `channel_${surface_num}_encoder`, {widget: {html: "@{this.value}"}}],
                )
                break;
            case ChannelEncoderMode.PAN:
                application.addLink(`strip_${app_num}_pan`,
                   [xtouch_surface, `channel_${surface_num}_encoder`],
                   [ui_surface, `channel_${surface_num}_encoder`, {widget: {html: "@{this.value}"}}],
                )
                break;
        }
    }

    // Show whether additional bank up/down is possible
    // TODO: Should this not use controls directly?
    application.controls['virtual_bank_down'].processValue(bank > 0 ? 1 : 0)
    application.controls['virtual_bank_up'].processValue(1)
}

var application
var xtouch_surface
var ui_surface

function setup_interface() {
    // TODO: Move into xtouch
    const xtouch_channel_nums = Array.from(Array(xtouch.NUM_CHANNELS), (_, i) => i+1)
    console.log("CHANNELS", xtouch_channel_nums)

    let surface_widgets = xtouch.create_widgets()
    for (let num of xtouch_channel_nums) {
        surface_widgets = util.insertAfterWidget(surface_widgets, `channel_${num}_button_select`, {
            type: 'text',
            id: `channel_${num}_name`,
            address: 'channel_name',
            preArgs: [num],
        })
    }

    let widgets = [{
        type: 'panel',
        id: 'inner_root',
        layout: 'vertical',
        width: surface_widgets[0].width,
        height: '100%',
        widgets: [
            {
                type: 'text',
                id: 'notice',
                value: 'THIS IS NOT THE VIRTUAL XTOUCH',
                width: '100%',
            },
            {
                type: 'panel',
                id: 'surface',
                layout: 'horizontal',
                width: surface_widgets[0].width,
                height: '90%',
                widgets: surface_widgets,
            },
            {
                type: 'panel',
                id: 'debug',
                layout: 'horizontal',
                width: surface_widgets[0].width,
                height: '10%',
                // This adds some debug buttons that only exist in the
                // ui and do not map to surface or app controls. These
                // do need an address so the client can communicate
                // events to the server.
                widgets: [
                    {
                        id: 'debug_print_controls',
                        label: 'Print\ncontrols',
                        type: 'button',
                        mode: 'tap',
                        address: '/print_controls',
                        onReceive: (value) => { application.debugLogControls() },
                    },
                    {
                        id: 'debug_print_links',
                        label: 'Print\nlinks',
                        type: 'button',
                        mode: 'tap',
                        address: '/print_links',
                        onReceive: (value) => { application.debugLogLinks() },
                    },
                    {
                        id: 'debug_refresh_plugins',
                        label: 'Refresh\nplugins',
                        type: 'button',
                        mode: 'tap',
                        address: '/refresh_plugins',
                        onReceive: (value) => { application.requestStripPluginValues() },
                    },
                    {
                        id: 'plugin_page',
                        label: 'plugin page up',
                        type: 'button',
                        mode: 'tap',
                        address: '/plugin_page',
                        onReceive: (value) => { application.send('/select/plug_page', 1) },
                    },
                ],
            },
        ]
    }]
    ui_surface.replaceWidgets(widgets)
}


var init_state = {
    app_setup: false,
    session_setup: false
}

function maybe_initialize(new_state) {
    Object.assign(init_state, new_state)
    console.debug("Maybe init", init_state)

    if (!Object.values(init_state).includes(false)) {
        setup_interface()
        setup_virtual_controls()
        setup_initial_links()
    }
}

var app_init_complete = false
var session_setup_complete = false

// This sets up javascript state and is ran on both first load and reload
function load() {
    // TODO: Move to load function or so and keep only widget
    // creation here?
    if (!settings.read('send')) {
        console.error('(ERROR) "send" option not set, aborting')
    }
    let target = settings.read('send')[0].split(':')
    application = new ardour.Application({target, init_complete: () => { maybe_initialize({app_setup: true}) }})

    let surface_widgets = xtouch.create_widgets()
    // TODO: Move into xtouch.js
    xtouch_surface = new core.Surface({target: ['midi', 'xtouch']})
    util.controlsFromWidgets(surface_widgets, xtouch_surface)

    ui_surface = new core.UiSurface()
}

module.exports = {
    // This is called (explicitly below) whenever the module is loaded,
    // so on startup (before init()) and then whenever the module is
    // autoreloaded.  This should set up any javascript state (which is
    // discarded on autoreload).
    reload: () => {
        load()
        application.reload()
        // If reloading, assume that the session was already set up
        maybe_initialize({session_setup: true})
    },

    // This is called once on startup by open-stage-control after the
    // OSC connection is set up. This should send startup OSC commands
    // to initialize the connection. It is not called again when the
    // module is reloaded, so any javascript state should be set up in
    // init_reload()
    init: () => {
        load()
        application.init()
        //xtouch.init();

        // This sets up a new session to prevent having to pass `--load`
        // oni the commmandline. This is done only once at startup, not
        // on reload.
        app.once('open', () => {
            console.debug("app.open event")
	    app.once('sessionSetPath', (data) => {
                console.debug("app.sessionSetPath event")
                // Only after the session is opened the cliet is ready
                // to receive widgets
		maybe_initialize({session_setup: true})
	    })
            receive('', '', '/SESSION/CREATE')
        })
    },

    oscInFilter: function(data) {
        let {address, args, host, port} = data
        //console.log("IN", host, port, address, args)

        for (let handler of [application, xtouch_surface]) {
            if (handler.target[0] == host && handler.target[1] == port && handler.processMessage(address, args))
                break
        }

        // TODO: What to pass through to client?
        return {address, args, host, port}
    },

    oscOutFilter: function(data) {
        var {address, args, host, port} = data
        //console.log("OUT", host, port, address, args)
        if (ui_surface.target[0] == host && ui_surface.target[1] == port) {
            ui_surface.processMessage(address, args)
            // If the target matches the ui surface, drop it, since
            // osc will not know where to send these messages anyway
            return null
        }

        return {address, args, host, port}
    }

}

// TODO Remove once https://github.com/jean-emmanuel/open-stage-control/pull/851 is merged
//module.exports.reload()
/*
console.log("app", Object.getOwnPropertyNames(app))
console.log("app", Object.getOwnPropertyNames(Object.getPrototypeOf(app)))
console.log("moduel", Object.getOwnPropertyNames(module))
console.log("global", Object.getOwnPropertyNames(global))
console.log("process", Object.getOwnPropertyNames(process.mainModule))
console.log("process", process.moduleLoadList)
*/
