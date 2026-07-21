import multer from "multer";

export const handleMulterError = (err, req, res, next) => {
    if(err instanceof multer.MulterError) {
        // Multer's own error file too large, too many files,wrong filed name, etc.
        let message = "File upload error";

        switch(err.code) {
            case "LIMIT_FILE_SIZE":
                message: "FILE too large. Maximum sizes is 5MB";
                break;

            case "LIMIT_FILE_COUNT":
            case "LIMIT_UNEXPECTED_FILE":
                message: "Too many files, or unexpected filed name.";
                break;
            default: 
                message = err.message;
        }

        return res.status(400).json({
            status:'failed',
            message
        });
    }

    if(err) {
        return res.status(400).json({
            status:'failed',
            message: err.message || "Invalid file upload"
        });
    }

    next();
}