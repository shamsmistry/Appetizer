
module.exports = function (sequelize,DataTypes) {

    var users = sequelize.define(
        'users',
        {
            //mapping coulumns i-e datatypes, null checks etc
            uid: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            username: {type: DataTypes.STRING, allowNull: true},
            user_email: {type: DataTypes.STRING, allowNull: false},
            email_valid: {type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true},
            first_name: {type: DataTypes.STRING, allowNull: false},
            middle_name: {type: DataTypes.STRING, allowNull: true},
            last_name: {type: DataTypes.STRING, allowNull: true},
            bio: {type: DataTypes.TEXT, allowNull: true},
            gender: {type: DataTypes.ENUM('MALE', 'FEMALE', 'UNKNOWN'), allowNull: true},
            dob: {type: DataTypes.DATE, allowNull: true},
            dob_show: {type: DataTypes.ENUM('PUBLIC', 'PRIVATE'), allowNull: true},
            password: {type: DataTypes.STRING, allowNull: false},
            profile_image_id: {type: DataTypes.INTEGER(11), allowNull: true},
            cover_image_id: {type: DataTypes.INTEGER(11), allowNull: true},
            default_image_id: {type: DataTypes.INTEGER(11), allowNull: true},
            default_cover_image_id: {type: DataTypes.INTEGER(11), allowNull: true},
            privacy_type: { type: DataTypes.ENUM('PUBLIC', 'PRIVATE'), allowNull: true },
            lang: { type: DataTypes.STRING, allowNull: true },
            created: {type: DataTypes.INTEGER(11), allowNull: false},
            updated: {type: DataTypes.INTEGER(11), allowNull: true},
            status: {type: DataTypes.ENUM('ACTIVE', 'DEACTIVATED', 'DELETED', 'DELETING', 'FLAGGED'), allowNull: false},
            featured_profile: {type: DataTypes.ENUM('YES', 'NO'), allowNull: true},
            account_verified: {type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true},
            role_id: {type: DataTypes.INTEGER(11), allowNull: false},
            country_id: {type: DataTypes.INTEGER(4), allowNull: false},
            country_id_guess: {type: DataTypes.ENUM('GUESS', 'USER'), allowNull: false},
            fb_uid: {type: DataTypes.STRING, allowNull: true},
            tw_uid: {type: DataTypes.STRING, allowNull: true},
            gp_uid: {type: DataTypes.STRING, allowNull: true},
            twitter_oauth_token: {type: DataTypes.STRING, allowNull: true},
            twitter_oauth_token_secret: {type: DataTypes.STRING, allowNull: true},
            username_by: {type: DataTypes.ENUM('SYSTEM', 'USER'), allowNull: false},
            timezone: {type: DataTypes.INTEGER(4), allowNull: true},
            last_login: { type: DataTypes.INTEGER(11), allowNull: true },
            last_login_ip: {type: DataTypes.STRING, allowNull: true},
            lastactivity: {type: DataTypes.DATE, allowNull: true},
            created_at: {type: DataTypes.DATE, allowNull: true},
            updated_at: {type: DataTypes.DATE, allowNull: true},
            location_id: {type: DataTypes.INTEGER(11), allowNull: true},
            user_location: {type: DataTypes.INTEGER(11), allowNull: true},
            chatRoomId: {type: DataTypes.STRING, allowNull: true},
            onboarding_web: {type: DataTypes.INTEGER(1)},
            //Derived Attributes
            privacy: {type: DataTypes.VIRTUAL},
            isFollower: {type: DataTypes.VIRTUAL},
            isFollowing: {type: DataTypes.VIRTUAL},
            isMute: {type: DataTypes.VIRTUAL}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'users',
            classMethods: {
                associate: function(models) {
                    users.hasMany(models.goals, { foreignKey : 'uid'});
                    users.hasMany(models.user_followers, { foreignKey: 'uid'} );
                    users.hasOne(models.featured_users, { foreignKey : 'uid'});
                    users.hasOne(models.user_stats, { foreignKey: 'uid' });
                    users.hasMany(models.sessions, { foreignKey : 'uid'});
                    users.hasMany(models.suggested_users_ignored, { foreignKey : 'uid'});
                    users.hasMany(models.user_block, { foreignKey : 'uid'});
                    users.hasMany(models.user_email_verification, { foreignKey : 'uid'});
                    users.hasMany(models.user_follow_request, { foreignKey : 'uid'});
                    users.hasMany(models.user_mute, { foreignKey : 'uid'});
                    users.hasMany(models.user_password_verification, { foreignKey : 'uid'});
                    users.hasMany(models.views_user_profile, { foreignKey : 'uid'});
                    users.hasMany(models.user_file_uploads, { foreignKey : 'uid'});
                    users.hasMany(models.goal_followers, { foreignKey : 'uid'});

                    users.hasMany(models.views_goal, { foreignKey : 'uid'});
                    users.hasMany(models.goal_linked, { foreignKey : 'uid'});
                    users.hasMany(models.goal_mute, { foreignKey : 'uid'});
                    users.hasMany(models.user_activity, { foreignKey : 'uid'});

                    users.belongsTo(models.user_defined_location, { targetKey: 'id', foreignKey : 'user_location'});
                    // users.belongsTo(models.user_file_uploads, { targetKey: 'id', foreignKey : 'profile_image_id', as: 'profile'});
                    // users.belongsTo(models.user_file_uploads, { targetKey: 'id', foreignKey : 'cover_image_id', as: 'cover'});
                }
            }
        }
    );
    return users;
};