// Shorthand for osc sending to default app / target
to_send = (address, ...args) => {
    send(send_host, send_port, address, ...args)
}

to_osc = (address, ...args)=>{
    receive(send_host, send_port, address, ...args)
}

CHANNEL_WIDTH = 100
NUM_CHANNELS = 8
ENCODER_BUTTON_HEIGHT = 20
// TODO: knobSize for faders

function create_widgets() {
    return [
        {
            type: 'panel',
            id: 'channels',
            layout: 'horizontal',
            width: NUM_CHANNELS * CHANNEL_WIDTH,
            height: '100%',
            label: false,
            scroll: false,
            innerPadding: false,
            widgets: create_channels(),
        },
        create_master(),
        create_side_panel(),
    ]
}

function create_master() {
    widgets = []
    widgets.push({
        type: 'panel',
        id: 'master_spacer',
        width: CHANNEL_WIDTH,
        height: 4*CHANNEL_WIDTH,
        lineWidth: 0,
    })

    widgets.push({
        type: 'fader',
        id: 'master_fader',
        width: CHANNEL_WIDTH,
        expand: true, // Fill remaining height
        address: '/control',
        preArgs: [1, 9],
        range: {"min": 0, "max": 127},
    })

    widgets.push({
        type: 'button',
        // Send on-value when pressed, never send off value.
        // Button state reflects feedback only
        mode: 'tap',
        decoupled: true,
        id: 'master_button',
        width: CHANNEL_WIDTH,
        height: CHANNEL_WIDTH,
        address: '/note',
        preArgs: [1, 48],
    })

    return {
        type: 'panel',
        id: 'master',
        layout: 'vertical',
        width: CHANNEL_WIDTH,
        height: '100%',
        lineWidth: 0,
        widgets: widgets,
    }
}


function create_side_panel() {
    encoders = []
    for(var encoder_idx = 0; encoder_idx < 8; encoder_idx++) {
        encoder_num = 9 + encoder_idx
        encoders.push({
            type: 'panel',
            layout: 'vertical',
            lineWidth: 0,
            width: CHANNEL_WIDTH,
            height: CHANNEL_WIDTH + ENCODER_BUTTON_HEIGHT,
            widgets: [{
                type: 'knob',
                id: 'aux_encoder_' + encoder_num,
                width: CHANNEL_WIDTH,
                height: CHANNEL_WIDTH,
                address: '/control',
                preArgs: [1, 18 + encoder_idx],
                range: {"min": 0, "max": 127},
            }, {
                type: 'button',
                // Send on-value when pressed, never send off value.
                // Button state reflects feedback only
                mode: 'tap',
                decoupled: true,
                // This matches feedback value from QLCplus, not sure if
                // actual xtouch is also picky like this
                on: 127,
                id: 'aux_encoder_' + encoder_num + '_button',
                width: CHANNEL_WIDTH,
                height: ENCODER_BUTTON_HEIGHT,
                address: '/note',
                preArgs: [1, 8 + encoder_idx],
            }],
        })
    }

    buttons = []
    for(var button_idx = 0; button_idx < 6; button_idx++) {
        button_num = button_idx + 1
        buttons.push({
            type: 'button',
            // Send on-value when pressed, never send off value.
            // Button state reflects feedback only
            mode: 'tap',
            decoupled: true,
            // In osc, button is on only when this value is matched
            // exactly. X-touch treats any non-zero value as on.
            // QLCPlus sends 127 for on, so this matches that. X-touch
            // does send 127 on button press.
            // TODO: Can we behave like x-touch with an onValue callback or so?
            on: 127,
            id: 'control_button_' + button_num,
            width: CHANNEL_WIDTH,
            height: CHANNEL_WIDTH,
            address: '/note',
            preArgs: [1, 49 + button_idx],
        })
    }

    return {
        type: 'panel',
        id: 'side',
        layout: 'vertical',
        width: 2 * CHANNEL_WIDTH,
        height: '100%',
        lineWidth: 0,
        widgets: [
            {
                type: 'panel',
                id: 'aux_encoders',
                layout: 'grid',
                width: 2 * CHANNEL_WIDTH,
                height: 4 * CHANNEL_WIDTH,
                lineWidth: 0,
                widgets: encoders,
            },
            {
                type: 'panel',
                id: 'control_buttons',
                layout: 'grid',
                width: 2 * CHANNEL_WIDTH,
                height: 3 * CHANNEL_WIDTH,
                lineWidth: 0,
                widgets: buttons,
            },
        ],
    }
}

function create_channels() {
    channels = []
    for(var channel_idx = 0; channel_idx < NUM_CHANNELS; channel_idx++) {
        channel_num = channel_idx + 1

        widgets = []
        widgets.push({
            type: 'panel',
            layout: 'vertical',
            lineWidth: 0,
            width: CHANNEL_WIDTH,
            height: CHANNEL_WIDTH,
            widgets: [{
                type: 'knob',
                id: 'channel_' + channel_num + '_encoder',
                width: CHANNEL_WIDTH,
                height: CHANNEL_WIDTH,
                address: '/control',
                preArgs: [1, 10 + channel_idx],
                range: {"min": 0, "max": 127},
            }, {
                type: 'button',
                // Send on-value when pressed, never send off value.
                // Button state reflects feedback only
                mode: 'tap',
                decoupled: true,
                // This matches feedback value from QLCplus, not sure if
                // actual xtouch is also picky like this
                on: 127,
                id: 'channel_' + channel_num + '_encoder_button',
                width: CHANNEL_WIDTH,
                height: ENCODER_BUTTON_HEIGHT,
                address: '/note',
                preArgs: [1, 0 + channel_idx],
            }],
        })

        for(var button_idx = 0; button_idx < 3; button_idx++) {
            button_num = button_idx + 1
            widgets.push({
                type: 'button',
                // Send on-value when pressed, never send off value.
                // Button state reflects feedback only
                mode: 'tap',
                decoupled: true,
                // This matches feedback value from QLCplus, not sure if
                // actual xtouch is also picky like this
                on: 127,
                id: 'channel_' + channel_num + '_button_' + button_num,
                value: false,
                width: CHANNEL_WIDTH,
                height: CHANNEL_WIDTH,
                address: '/note',
                preArgs: [1, 16 + button_idx * 8 + channel_idx],
            })
        }

        widgets.push({
            type: 'fader',
            id: 'channel_' + channel_num + '_fader',
            value: 0,
            width: CHANNEL_WIDTH,
            expand: true, // Fill remaining height
            address: '/control',
            preArgs: [1, 1 + channel_idx],
            range: {"min": 0, "max": 127},
        })

        widgets.push({
            type: 'button',
            // Send on-value when pressed, never send off value.
            // Button state reflects feedback only
            mode: 'tap',
            decoupled: true,
            id: 'channel_' + channel_num + '_button_select',
            value: false,
            width: CHANNEL_WIDTH,
            height: CHANNEL_WIDTH,
            address: '/note',
            preArgs: [1, 40 + channel_idx],
        })

        channels.push({
            type: 'panel',
            id: 'channel_' + channel_num,
            layout: 'vertical',
            //label: false,
            //scroll: false,
            //padding: 0,
            width: CHANNEL_WIDTH,
            height: '100%',
            lineWidth: 0,
            //innerPadding: false,
            widgets: widgets,
        })
    }
    return channels
}

function update_widgets() {
    if (!(global.surface_no_init ?? false)) {
        widgets = create_widgets()
        to_osc('/EDIT', 'root', {
            widgets: widgets,
        })
    }
}

module.exports = {
    // This is called (explicitly below) whenever the module is loaded,
    // so on startup (before init()) and then whenever the module is
    // autoreloaded.  This should set up any javascript state (which is
    // discarded on autoreload).
    init_reload: () => {
        if (settings.read('send')) {
            [send_host, send_port] = settings.read('send')[0].split(':')
        } else {
            console.warn('(WARNING) "send" option not set')
        }

        // Update widgets here too, in case of code reload to facilitate debugging
        update_widgets();
    },

    // This is called once on startup by open-stage-control after the
    // OSC connection is set up. This should send startup OSC commands
    // to initialize the connection. It is not called again when the
    // module is reloaded, so any javascript state should be set up in
    // init_reload()
    init: () => {
    },

    create_widgets: create_widgets,
    NUM_CHANNELS,
}

app.on('sessionOpened', update_widgets)

module.exports.init_reload()
