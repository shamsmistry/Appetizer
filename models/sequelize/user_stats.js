
module.exports  = function (sequelize, DataTypes) {
    var user_stats = sequelize.define(
        'user_stats',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: { autoIncrement: true, type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
            uid: { type: DataTypes.INTEGER(11), allowNull: false },
            followers: { type: DataTypes.INTEGER(11), allowNull: false },
            followings: { type: DataTypes.INTEGER(11), allowNull: false },
            goals: { type: DataTypes.INTEGER(11), allowNull: false },
            views: { type: DataTypes.INTEGER(11), allowNull: false },
            goal_followings: { type: DataTypes.INTEGER(11), allowNull: false }
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'user_stats',
            classMethods: {
                associate: function(models) {
                    user_stats.belongsTo(models.users, { foreignKey: 'uid'} );
                }
            }
        }
    );

    return user_stats;
};


/*
    DROP TABLE IF EXISTS `user_stats`;
    CREATE TABLE `user_stats` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `uid` int(11) DEFAULT '0',
    `followers` int(11) DEFAULT '0',
    `followings` int(11) DEFAULT '0',
    `goals` int(11) DEFAULT '0',
    `views` int(11) DEFAULT '0',
    `goal_followings` int(11) DEFAULT '0',
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;
*/
