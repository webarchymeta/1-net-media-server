import audio_spectrum from '../lib/audio-spectrum';
import indexed_db from '../lib/indexed-db';

const video_margin = 10;

const fitWindow = (c, v) => {
    var win = $(window);
    if (v.height() > win.height() - video_margin) {
        v.height(win.height() - video_margin);
    }
};

const settings_db = () => window.__media_cast_settings_db;

const channel = function (p, data) {
    const self = this;
    const parent = p;
    self.id = data.id;
    self.elem_id = data.type + '_' + data.id.replace('::', '_');
    self.rand_qstr = '_' + Math.floor(10000 * Math.random());
    self.type = data.type;
    self.live_stream = !!data.live_stream;
    self.mime_type = data.mime_type;
    self.user_id = data.user_id;
    self.endpoint_id = data.endpoint_id;
    self.pre_existing = true;
    self.disabled = ko.observable(false);
    self.support_stream = ko.observable(false);
    self.enable_spec = ko.observable(data.type === 'audio');
    self.playing = ko.observable(false);
    let media_stream = undefined;
    let elem = undefined;
    let spec = undefined;

    self.enable_spec.subscribe(b => {
        if (!b) {
            if (spec) {
                spec.stop_animate();
                spec = undefined;
                media_stream = undefined;
            }
        }
    });

    self.close_spectrum = () => {
        self.enable_spec(false);
    };

    self.bind_element = () => {
        setTimeout(() => {
            const container = $('#' + self.elem_id);
            if (container.length > 0) {
                let childs = undefined;
                if (self.type === 'audio') {
                    childs = container.find('audio');
                } else if (self.type === 'video' || self.type === 'screen') {
                    childs = container.find('video');
                }
                if (childs && childs.length > 0) {
                    elem = childs[0];
                    if (elem.readyState === 4) {
                        self.playing(true);
                        if (self.type === 'video' || self.type === 'screen') {
                            fitWindow(container, childs);
                        }
                    }
                    const try_create_stream = () => {
                        if (elem.captureStream) {
                            media_stream = elem.captureStream();
                            self.support_stream(true);
                        } else if (elem.mozCaptureStream) {
                            media_stream = elem.mozCaptureStream();
                            self.support_stream(true);
                        } else {
                            console.log('captureStream() not supported');
                        }
                    };
                    const gen_spectrum = () => {
                        if (self.support_stream() && self.enable_spec()) {
                            if (spec) {
                                return;
                            }
                            if (!media_stream) {
                                media_stream = elem.captureStream ? elem.captureStream() : elem.mozCaptureStream();
                            }
                            const canvas = container.find('canvas');
                            if (canvas.length > 0) {
                                spec = new audio_spectrum(canvas[0], {
                                    strokeStyle: '#ddd'
                                });
                                spec.start_animate(media_stream, true);
                            }
                        }
                    };
                    if (elem.readyState >= 3) {
                        try_create_stream();
                    }
                    if (elem.readyState === 4) {
                        self.playing(true);
                        if (self.type === 'video' || self.type === 'screen') {
                            fitWindow(container, childs);
                        }
                        gen_spectrum();
                    }
                    elem.oncanplay = () => {
                        try_create_stream();
                    };
                    elem.onplay = () => {
                        self.playing(true);
                        if (self.type === 'video' || self.type === 'screen') {
                            fitWindow(container, childs);
                        }
                        gen_spectrum();
                    };
                    elem.onended = () => {
                        if (spec) {
                            spec.stop_animate();
                            spec = undefined;
                            media_stream = undefined;
                        }
                        self.playing(false);
                    };
                }
            }
        }, 300);
    };
};

const stream_model = function (ws) {
    const self = this;
    let settings = undefined;
    self.ws = ws;
    self.channels = ko.observableArray();
    self.active_channels = ko.pureComputed(() => self.channels().filter(c => !c.disabled()));
    self.audio_spectrum_disabled = ko.observable(false);
    self.video_spectrum_disabled = ko.observable(true);

    self.ws.on('/stream-cast/channel-join', cdata => {
        const c = new channel(self, cdata);
        c.pre_existing = false;
        if (c.type === 'audio')
            c.enable_spec(!self.audio_spectrum_disabled());
        else if (c.type === 'video' || c.type === 'screen')
            c.enable_spec(!self.video_spectrum_disabled());
        self.channels.push(c);
        c.bind_element();
    });

    self.ws.on('/stream-cast/channel-leave', cdata => {
        self.channels.remove(c => c.id === cdata.id);
    });

    self.toggle_audio_spectrum = () => {
        self.audio_spectrum_disabled(!self.audio_spectrum_disabled());
        if (self.audio_spectrum_disabled()) {
            self.channels().filter(c => c.type === 'audio').forEach(c => {
                c.enable_spec(false);
            });
        }
        if (!settings) {
            settings = {
                audio_spectrum_disabled: self.audio_spectrum_disabled()
            };
        } else {
            settings.audio_spectrum_disabled = self.audio_spectrum_disabled();
        }
        settings_db().put('properties', settings);
    };

    self.toggle_video_spectrum = () => {
        self.video_spectrum_disabled(!self.video_spectrum_disabled());
        if (self.video_spectrum_disabled()) {
            self.channels().filter(c => c.type === 'video' || c.type === 'screen').forEach(c => {
                c.enable_spec(false);
            });
        }
        if (!settings) {
            settings = {
                video_spectrum_disabled: self.video_spectrum_disabled()
            };
        } else {
            settings.video_spectrum_disabled = self.video_spectrum_disabled();
        }
        settings_db().put('properties', settings);
    };

    self.init = () => {
        window.__media_cast_settings_db = new indexed_db('media.cast.settings');
        if (!settings_db().open) {
            window.location.href = 'error?msg=' + encodeURIComponent(JSON.stringify(['The current browser is too old for this service!']));
            return;
        }
        return settings_db().open().then(() => {
            settings_db().get('properties').then(props => {
                settings = props;
                if (settings) {
                    if (typeof settings.audio_spectrum_disabled !== 'undefined')
                        self.audio_spectrum_disabled(settings.audio_spectrum_disabled);
                    if (typeof settings.video_spectrum_disabled !== 'undefined')
                        self.video_spectrum_disabled(settings.video_spectrum_disabled);
                }
                return fetch('/stream-cast/load-channels', {
                    method: 'post',
                    credentials: 'same-origin',
                    headers: {
                        'Accept': 'application/json, text/plain',
                        'Content-Type': 'application/json'
                    },
                    body: ''
                }).then(res => res.json()).then(channels => {
                    if (channels) {
                        channels.forEach(cdata => {
                            const c = new channel(self, cdata);
                            c.pre_existing = true;
                            self.channels.push(c);
                            if (c.type === 'audio')
                                c.enable_spec(!self.audio_spectrum_disabled());
                            else if (c.type === 'video' || c.type === 'screen')
                                c.enable_spec(!self.video_spectrum_disabled());
                            c.bind_element();
                        });
                    }
                });
            });
        });
    };
};

export default stream_model;