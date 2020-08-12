module.exports = {
    error: (err, next) => {
        if (!err.statusCode) err.statusCode = 500
        next(err)
    },
    errorHandler: (res, message, type = "") => {
        res.send({error: message, type})
    },
    validationError: (err, res, type = "") => {
        if (!err.isEmpty()) {
            const message = err.array()[0].msg
            const type = err.array()[0].param
            res.send({error: message, type})
        }
    }
}