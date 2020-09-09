const cloudinary = require('cloudinary').v2
const error = require('../error-handling/error-handler')

module.exports = {
    removeImage: async (public_id) => {
        await cloudinary.uploader.destroy(
            public_id, 
            { invalidate: true, resource_types: "image" },
            async (err, result) => {
                if (err) {
                    error.errorHandler(res, "Image not deleted", "image")
                }
            }
        )
    }
}