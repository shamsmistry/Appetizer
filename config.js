exports.baseUrl = {
    apiServer: process.env.API_SERVER_URL,
    fileServer: process.env.FILE_SERVER_URL,
    domain: process.env.WEB_SERVER_URL,
    socketServer: process.env.SOCKET_SERVER_URL
};

//ffmpeg configurations
exports.ffmpegConfig = {
    path: 'C:/ffmpeg/bin/ffmpeg.exe',
    videoCodecLib: 'libx264',
    audioCodecLib: 'libmp3lame',
    videoFormat: 'mp4'
};

//get location from IP
exports.maxmind = {
    path: process.env.MAXMIND_PATH
};

// ********** Normal Configuration ******* //

exports.notificationContextIdEncryption = {
    algorithm: "XXXXXXXXXXXXXX",
    key: "XXXXXXXXXXXX"
}

exports.encryption = {
    salt: "XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    size: 40
}

exports.pagination = {
    offset: 0,
    limit: 5
};

exports.webURL = {
    domain: '',
    cdn: ''
};

//default images name
exports.defaultImages = {
    profile: 'default_profile.jpg',
    cover: 'default_cover.jpg',
    goal: 'default_goal.jpg'
};

//directory paths
exports.path = {
    uploadPath: 'resources/uploads/',
    downloadPath: 'resources/downloads/images/',
    userFilePath: 'users/',

    profilePath: 'profile/',
    coverPath: 'cover/',
    contributionFilePath: 'contributions/',
    goalFilePath: 'goals/',
    postsFilePath: 'posts/',
    commentsFilePath: 'comments/',
    categoriesFilePath: 'categories/',
    subCategoriesFilePath: 'subcategories/',
    bannerFilePath: 'banner/',

    albumsPath: 'albums/',
    imagesAlbumPath: 'images/',
    videosAlbumPath: 'videos/',
    audiosAlbumPath: 'audios/',

    defaultFolderPath: 'default_files/',

    defaultSmallThumb: 'thumb/100x100/',
    defaultMediumThumb: 'thumb/200x200/',
    defaultLargeThumb: 'thumb/400x400/',

    defaultCoverSmallThumb: 'thumb/490x170/',
    defaultCoveMediumThumb: 'thumb/980x340/',
    defaultCoveLargeThumb: 'thumb/1960x680/',

    defaultGoalSmallThumb: 'thumb/300x225/',
    defaultGoalMediumThumb: 'thumb/528x297/',
    defaultGoalLargeThumb: 'thumb/980x340/',
    defaultGoalXlargeThumb: 'thumb/1960x680/',

    sdPath: 'sd/',
    hdPath: 'hd/',

    smallThumb: '100x100/',
    mediumThumb: '200x200/',
    largeThumb: '400x400/',

    coverSmallThumb: '490x170/',
    coverMediumThumb: '980x340/',
    coverLargeThumb: '1960x680/',

    goalSmallThumb: '300x225/',
    goalMediumThumb: '528x297/',
    goalLargeThumb: '980x340/',
    goalXlargeThumb: '1960x680/',

    postSmallThumb: '150x150/',
    postMediumThumb: '640x360/',
    postSquareThumb: '1280x720/',

    categoriesSmallThumb: '128x128/',
    categoriesMediumThumb: '256x256/',

    subCategoriesSmallThumb: '128x128/',
    subCategoriesMediumThumb: '256x256/',

    bannerMediumThumb: '980x340/',
    bannerLargeThumb: '1960x680/',

}

//thumb sizes
exports.thumbSize = {
    profile: [
        {
            "width": 100,
            "height": 100
        },
        {
            "width": 200,
            "height": 200
        },
        {
            "width": 400,
            "height": 400
        }
    ],
    cover: [
        {
            "width": 490,
            "height": 170
        },
        {
            "width": 980,
            "height": 340
        },
        {
            "width": 1960,
            "height": 680
        }
    ],
    goal: [
        {
            "width": 300,
            "height": 225
        },
        {
            "width": 528,
            "height": 297
        },
        {
            "width": 980,
            "height": 340
        },
        {
            "width": 1960,
            "height": 680
        }
    ],
    contribute: [
        {
            "width": 100,
            "height": 100
        },
        {
            "width": 200,
            "height": 200
        },
        {
            "width": 400,
            "height": 400
        }
    ],
    comment: [
        {
            "width": 100,
            "height": 100
        },
        {
            "width": 200,
            "height": 200
        },
        {
            "width": 400,
            "height": 400
        }
    ],
    post: [
        {
            "width": 150,
            "height": 150
        },
        {
            "width": 640,
            "height": 360
        },
        {
            "width": 1280,
            "height": 720
        }
    ],
    albumProfile: [
        {
            "width": 100,
            "height": 100
        },
        {
            "width": 200,
            "height": 200
        },
        {
            "width": 400,
            "height": 400
        }
    ],
    albumCover: [
        {
            "width": 490,
            "height": 170
        },
        {
            "width": 980,
            "height": 340
        },
        {
            "width": 1960,
            "height": 680
        }
    ],
    videoThumbs: [
        {
            "width": 320,
            "height": 240
        }
    ],
    categories: [
        {
            "width": 128,
            "height": 128
        },
        {
            "width": 256,
            "height": 256
        },
    ],
    subCategories: [
        {
            "width": 128,
            "height": 128
        },
        {
            "width": 256,
            "height": 256
        },
    ],
    banner: [
        {
            "width": 980,
            "height": 340
        },
        {
            "width": 1960,
            "height": 680
        }
    ],

}

//thumb directories name
exports.thumbDirName = {
    cover: ["490x170", "980x340", "1960x680"],
    profile: ["100x100", "200x200", "400x400"],
    goal: ["300x225", "528x297", "980x340", "1960x680"],
    contribute: ["100x100", "200x200", "400x400"],
    comment: ["100x100", "200x200", "400x400"],
    post: ["150x150", "640x360", "1280x720"],
    albumProfile: ["100x100", "200x200", "400x400"],
    albumCover: ["490x170", "980x340", "1960x680"],
    categories: ["128x128", "256x256"],
    subCategories: ["128x128", "256x256"],
    banner: ["980x340", "1960x680"],

}

//thumb type name
exports.thumbName = {
    small: 'thumb/small/',
    medium: 'thumb/medium/',
    large: 'thumb/large/',
    xlarge: 'thumb/xlarge/',
    square: 'thumb/square/',
    original: 'org/org/',

    videoThumbOneDir: 'thumb/_1/',
    videoThumbTwoDir: 'thumb/_2/',
    videoThumbThreeDir: 'thumb/_3/',
    videoThumbFourDir: 'thumb/_4/',

    videoSDDir: 'cmp/sd/',
    videoHDDir: 'cmp/hd/'
}

//video configurations
exports.videoConfig = {
    compressSize: [
        {
            "width": 640,
            "height": 320
        },
        {
            "width": 1280,
            "height": 720
        }
    ],
    compressDirName: ["640x320", "1280x720"],
    compressType: ["sd", "hd"],
    thumbExtension: '.png',
    dirName: 'videos',
    thumbPrefix: '_tn',
    thumbOneSuffix: '_1',
    thumbTwoSuffix: '_2',
    thumbThreeSuffix: '_3',
    thumbFourSuffix: '_4',
    thumbCount: 4,
    thumbSize: '320x240',
    thumbDirName: 'thumb'
};

//audio configurations
exports.audioConfig = {
    dirName: 'audios',
    format: 'mp3'
};
