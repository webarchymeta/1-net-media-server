import model from '../models/admin-model.js';

$(() => {
    const m = new model();
    m.load_data().then(() => {

    });
    ko.applyBindings(m);
});