

module.exports = function (sequelize, DataTypes) {

    var goals = sequelize.define(
        'goals',
        {
            //mapping coulumns i-e datatypes, null checks etc
            goal_id: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            goal_name: {type: DataTypes.STRING(200), allowNull: false},
            goal_description: {type: DataTypes.TEXT, allowNull: true},
            g_start_date: {type: DataTypes.DATE, allowNull: true},
            g_end_date: {type: DataTypes.DATE, allowNull: true},
            goal_type: {type: DataTypes.ENUM('BASIC'), allowNull: true},
            default_goal_image_id: {type: DataTypes.INTEGER(11), allowNull: true},
            goal_image_id: {type: DataTypes.INTEGER(11), allowNull: true},
            category_id: {type: DataTypes.INTEGER(11), allowNull: true},
            goal_image: {type: DataTypes.STRING(255), allowNull: false, defaultValue: '0'},
            is_public: {type: DataTypes.BOOLEAN, allowNull: false, defaultValue: 1},
            featured: {type: DataTypes.BOOLEAN, allowNull: true},
            status: {type: DataTypes.ENUM('ACTIVE', 'DEACTIVATE', 'DELETED', 'FLAGGED', 'COMPLETED','USERDEACTIVATED'), allowNull: false},
            flag: {type: DataTypes.BOOLEAN, allowNull: false, defaultValue: 0},
            priority: {type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH'), allowNull: true},
            linked_goal_id: {type: DataTypes.INTEGER(11), allowNull: true},
            linked_type: { type: DataTypes.ENUM('DEFAULT', 'MERGE', 'SEPERATED'), allowNull: false, defaultValue: 'DEFAULT'},
            via_uid: {type: DataTypes.INTEGER(11), allowNull: true},
            via_uid_show: {type: DataTypes.ENUM('YES', 'NO'), allowNull: true},
            created: {type: DataTypes.INTEGER(11), allowNull: false},
            updated: {type: DataTypes.INTEGER(11), allowNull: true},
            scope_id: {type: DataTypes.INTEGER(11), allowNull: true},
            followers_count: {type: DataTypes.INTEGER(11), allowNull: false, defaultValue: 0},
            links_count: {type: DataTypes.INTEGER(11), allowNull: false, defaultValue: 0},
            location_id: {type: DataTypes.INTEGER(11), allowNull: true},
            user_location: {type: DataTypes.INTEGER(11), allowNull: true},
            completed: {type: DataTypes.INTEGER(11), allowNull: true},
            //Derived Attributes
            isLinked: {type: DataTypes.VIRTUAL},
            isFollower: {type: DataTypes.VIRTUAL},
            isMotivate: {type: DataTypes.VIRTUAL},
            isMute: {type: DataTypes.VIRTUAL}

        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'goals', // define the table's name
            classMethods: {
                associate: function (models) {
                    goals.hasOne(models.goal_stats, {foreignKey: 'goal_id'});
                    goals.hasOne(models.hot_new_goals, {foreignKey: 'goal_id'});
                    goals.hasMany(models.goal_motivate, {foreignKey: 'goal_id'});
                    goals.hasOne(models.popular_goals, {foreignKey: 'goal_id'});
                    goals.hasMany(models.goal_followers, {foreignKey: 'goal_id'});
                    goals.hasMany(models.views_goal, {foreignKey: 'goal_id'});
                   // goals.hasMany(models.goal_linked, {foreignKey: 'goal_id'});
                    goals.hasMany(models.goal_mute, {foreignKey: 'goal_id'});
                    goals.hasMany(models.goals_tags, {foreignKey: 'goal_id'});
                    goals.belongsTo(models.users, {foreignKey: 'uid'});
                    goals.belongsTo(models.user_defined_location, { targetKey: 'id', foreignKey : 'user_location'});
                }
            }
        }
    );
    return goals;
};