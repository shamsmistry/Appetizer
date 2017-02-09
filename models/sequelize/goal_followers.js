
//mapping database table default_category

module.exports = function (sequelize, DataTypes) {

    var goal_followers = sequelize.define(
        'goal_followers',
        {
            //mapping coulumns i-e datatypes, null checks etc
            _id: {type: DataTypes.BIGINT(20), allowNull: false, primaryKey: true, autoIncrement : true},
            goal_id: {type: DataTypes.INTEGER(11), allowNull: false},
            follower_uid: {type: DataTypes.INTEGER(11), allowNull: false},
            status: {type: DataTypes.ENUM('ACTIVE', 'INACTIVE','USERDEACTIVATED'), allowNull: false , defaultValue : 'ACTIVE'},
            created: {type: DataTypes.INTEGER(11), allowNull: false},
            updated: {type: DataTypes.INTEGER(11), allowNull: true}

        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,

            // define the table's name
            tableName: 'goal_followers',
            classMethods: {
                associate: function (models) {
                    goal_followers.belongsTo(models.goals, {foreignKey: 'goal_id'});
                    goal_followers.belongsTo(models.users, {foreignKey: 'follower_uid'});
                }
            }

        }
    );
    return goal_followers;
};