"use strict";

// Prevent xtouch.js from creating widgets
global.surface_no_init = 1

var core = require('./core.js')
var xtouch = require('./xtouch.js')
var hog4pc = require('./hog4pc.js')
var util = require('./util.js')

// These are predefined by open-stage-control. Declare them again to
// prevent tsserver check errors. Assigning them from global.something
// (which are just the same variables) to prevent "possibly 'undefined'"
// errors.
var send = send
var receive = receive
var app = app
var settings = settings

function setup_virtual_controls() {
    /*
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
    */
}

function setup_initial_links(s, ui) {
    link_masters(1, 8, s, ui)

    if (ui) {
        for (const control of Object.values(application.controls)) {
            if (control.id.startsWith('key_') && ui.controls[control.id] ) {
                application.addLink(control.id,
                   [ui, control.id],
                )
            }
        }
    }
    for(let num = 1; num <= 4; num++) {
        application.addLink(`wheel_${num}`,
           [s, `channel_${num}_encoder`],
           [ui, `channel_${num}_encoder`, {widget: {html: "@{this.value}"}}],
        )
    }

    application.addLink(`cmdline`,
       [ui, `cmdline`],
    )
}

function link_masters(first, count, s, ui) {
    console.debug(`Setting up masters ${first} to ${first+count}`)

    for (let num = first; num <first + count; num++) {
        // TODO: range steps / pips for faders, maybe logarithmic and use gain
        // instead of fader? And convert when linking to surface.
        application.addLink(`master_${num}_fader`,
           [s, `channel_${num}_fader`],
           [ui, `channel_${num}_fader`, {widget: {html: "@{this.value}"}}],
        )
        application.addLink(`master_${num}_flash`,
           [s, `channel_${num}_button_select`],
           [ui, `channel_${num}_button_select`, {widget: {label: "Flash"}}],
        )
        application.addLink(`master_${num}_choose`,
           [s, `channel_${num}_encoder_button`],
           [ui, `channel_${num}_encoder_button`, {widget: {label: `${num}`}}],
        )
        application.addLink(`master_${num}_go`,
           [s, `channel_${num}_button_1`],
           [ui, `channel_${num}_button_1`, {widget: {label: "▶"}}],
        )
        application.addLink(`master_${num}_pause`,
           [s, `channel_${num}_button_2`],
           [ui, `channel_${num}_button_2`, {widget: {label: "⏸"}}],
        )
        application.addLink(`master_${num}_goback`,
           [s, `channel_${num}_button_3`],
           [ui, `channel_${num}_button_3`, {widget: {label: "◀"}}],
        )
    }
}

var application
var surface
var ui_surface

function setup_interface() {
    // TODO: Move into xtouch
    const xtouch_channel_nums = Array.from(Array(xtouch.NUM_CHANNELS), (_, i) => i+1)
    console.log("CHANNELS", xtouch_channel_nums)

    let surface_widgets = xtouch.create_widgets()
    /*
    for (let num of xtouch_channel_nums) {
        surface_widgets = util.insertAfterWidget(surface_widgets, `channel_${num}_button_select`, {
            type: 'text',
            id: `channel_${num}_name`,
            address: 'channel_name',
            preArgs: [num],
        })
    }
    */

    let virtual_surface = {
        type: 'panel',
        id: 'virtual_surface',
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
                ],
            },
        ]
    }
    let keymap = [
        ['backspace', '⌫'], ['slash', '/'], ['minus', '-'], ['plus', '+'],
        ['seven', '7'], ['eight', '8'], ['nine', '9'], ['thru', 'Thru'],
        ['four', '4'], ['five', '5'], ['six', '6'], ['full', 'Full'],
        ['one', '1'], ['two', '2'], ['three', '3'], ['at', '@'],
        ['zero', '0'], ['period', '.'], ['enter', 'Enter'], ['clear', 'Clear'],
    ]

    let keypad_widgets = []
    for (const [name, label] of keymap) {
        keypad_widgets.push({
            id: `key_${name}`,
            label: label,
            type: 'button',
            mode: 'push',
            address: `/key_${name}`,
        })
    }

    let control_page = {
        type: 'panel',
        id: 'hogui',
        layout: 'vertical',
        height: '100%',
        width: '100%',
        widgets: [
            {
                type: 'text',
                id: 'cmdline',
                address: '/cmdline',
                label: 'cmdline',
            },
            {
                type: 'panel',
                id: 'keypad',
                layout: 'grid',
                width: '100%',
                gridTemplate: 4, // number of columns
                widgets: keypad_widgets,
            },
        ],
    }
    let widgets = [{
        type: 'panel',
        id: 'tabs',
        height: '100%',
        width: '100%',
        tabs: [
            virtual_surface,
            control_page,
        ],
    }]
    ui_surface.replaceWidgets(widgets)
}


var init_state = {
    app_setup: false,
    session_setup: false
}

function maybe_initialize(new_state) {
    let old_app_setup = init_state.app_setup
    let old_session_setup = init_state.session_setup
    Object.assign(init_state, new_state)
    console.debug("Maybe init", init_state)

    let link_s = null, link_ui = null
    if (!old_app_setup && init_state.app_setup) {
        setup_virtual_controls()
        link_s = surface
    }
    if (!old_app_setup && init_state.app_setup && init_state.session_setup
        || init_state.app_setup && new_state.session_setup) {
        setup_interface()
        link_ui = ui_surface
    }
    setup_initial_links(link_s, link_ui)
}

// This sets up javascript state and is ran on both first load and reload
function load() {
    // TODO: Move to load function or so and keep only widget
    // creation here?
    if (!settings.read('send')) {
        console.error('(ERROR) "send" option not set, aborting')
    }
    let target = settings.read('send')[0].split(':')
    application = new hog4pc.Application({target, init_complete: () => { maybe_initialize({app_setup: true}) }})

    let surface_widgets = xtouch.create_widgets()
    // TODO: Move into icontrols_pro.js
    surface = new core.Surface({target: ['midi', 'xtouch']})
    util.controlsFromWidgets(surface_widgets, surface)

    // Override the range of these encoders, which have been changed to relative2 mode in the editor.
    // The actual range here is a bit empirical, when you turn really fast, you
    // get up to about -5/+5 it seems. Doing -20/+20 to match the hog4pc range
    // was to slow, -10/+10 is reasonable (maybe still a little too slow).
    // TODO: Solve this more cleanly
    for (const id of ['channel_1_encoder', 'channel_2_encoder', 'channel_3_encoder', 'channel_4_encoder']) {
	surface.controls[id].range.min = 64 - 10
	surface.controls[id].range.max = 64 + 10
    }

    ui_surface = new core.UiSurface()
}

module.exports = {
    // This is called (explicitly below) whenever the module is loaded,
    // so on startup (before init()) and then whenever the module is
    // autoreloaded.  This should set up any javascript state (which is
    // discarded on autoreload).
    // TODO: Update this comment, seems reload might be called by osc now?
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

        // This sets up a new session to prevent having to pass `--load`
        // oni the commmandline. This is done only once at startup, not
        // on reload.
        app.on('open', () => {
            console.debug("app.open event")
	    app.on('sessionSetPath', (data) => {
                console.debug("app.sessionSetPath event")
                // Only after the session is opened the client is ready
                // to receive widgets
		maybe_initialize({session_setup: true})
	    })
            receive('', '', '/SESSION/CREATE')
        })
    },

    oscInFilter: function(data) {
        let {address, args, host, port} = data

        // Ignore spam
        if (address.startsWith('/hog/status/led/flash') || address == '/hog/status/time')
            return

        console.log("IN", host, port, address, args)

        for (let handler of [application, surface]) {
            if (handler.target[0] == host && handler.target[1] == port && handler.processMessage(address, args))
                break
        }


        // TODO: What to pass through to client?
        return {address, args, host, port}
    },

    oscOutFilter: function(data) {
        var {address, args, host, port} = data
        console.log("OUT", host, port, address, args)
        console.log(ui_surface.target)
        if (ui_surface.target[0] == host && ui_surface.target[1] == port) {
            ui_surface.processMessage(address, args)
            // If the target matches the ui surface, drop it, since
            // osc will not know where to send these messages anyway
            return null
        }

        return {address, args, host, port}
    }

}
