var mongoose = require('mongoose');

var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var Users = new Schema({
    //_id: ObjectId,
    "uid": {
        "type": Number
    },
    "username": {
        "type": String
    },
    "user_email": {
        "type": String
    },
    "first_name": {
        "type": String
    },
    "middle_name": {
        "type": String
    },
    "last_name": {
        "type": String
    },
    "bio": {
        "type": String
    },
    "gender": {
        "type": String
    },
    "dob_show": {
        "type": String
    },
    "profile_image_id": {
        "type": Number
    },
    "cover_image_id": {
        "type": Number
    },
    "default_image_id": {
        "type": Number
    },
    "default_cover_image_id": {
        "type": Number
    },
    "last_login": {
        "type": Number
    },
    "status": {
        "type": String
    },
    "created": {
        "type": Number

    },
    "user_location": {
        "type": Number
    },

    "onboarding_web": {
        "type": Number
    },
    "name": {
        "type": String
    },
    "link": {
        "type": String
    },
    "verified": {
        "type": "boolean"
    },
    "website": {
        "type": String
    },
    "profile": {
        "type": "object",
        "properties": {
            "medium": {
                "type": String
            },
            "large": {
                "type": String
            }
        }
    },
    "cover": {
        "type": "object",
        "properties": {
            "medium": {
                "type": String
            },
            "large": {
                "type": String
            }
        }
    },
    "social": {
        "type": "object",
        "properties": {}
    },
    "stats": {
        "type": "object",
        "properties": {
            "connections": {
                "type": "object",
                "properties": {
                    "followingCount": {
                        "type": Number

                    },
                    "followersCount": {
                        "type": Number

                    },
                    "views": {
                        "type": Number

                    }
                }
            },
            "goal": {
                "type": "object",
                "properties": {
                    "total": {
                        "type": Number

                    },
                    "linked": {
                        "type": Number

                    },
                    "following": {
                        "type": Number
                    }
                }
            }
        }
    },
    "type": "object",
    "properties": {
        "isFollowing": {
            "type": Number

        },
        "isFollower": {
            "type": Number

        },
        "isMuted": {
            "type": Number

        },
        "invitations": {
            "type": "object",
            "properties": {}
        }
    },
    "location": {
        "type": "object",
        "properties": {}
    },
    "isProtected": {
        "type": Number
    }

});

module.exports = mongoose.model('Users', Users);