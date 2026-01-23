const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter =(req, file, cb)=>{
    const allowedFileTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif',]
    if(allowedFileTypes.includes(file.mimetype)){
        cb(null, true)
    }else{
        cb(new Error('Only .jpeg, .jpg, .png, .gif format allowed!'), false)
    }
}

const upload = multer({
storage,
fileFilter,
limits:{
    fileSize: 1024 * 1024 * 5
}
}).array("images", 5)

module.exports = upload;