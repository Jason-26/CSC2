const Valid = {
    ID: function (id) {
        if (Number.isInteger(parseInt(id))) {
            return true;
        }
        else return false;
    },
    Email: function (email) {
        if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) return true;
        else return false;
    },
}

module.exports = Valid;