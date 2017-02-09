

module.exports = function (sequelize,DataTypes) {
    var goal_stats = sequelize.define(
        'goal_stats',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: { autoIncrement: true, type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
            goal_id: { type: DataTypes.INTEGER(11), allowNull: false },
            followers: { type: DataTypes.INTEGER(11), allowNull: false },
            links: { type: DataTypes.INTEGER(11), allowNull: false },
            links_forward: { type: DataTypes.INTEGER(11), allowNull: false },
            links_backward: { type: DataTypes.INTEGER(11), allowNull: false },
            motivations: { type: DataTypes.INTEGER(11), allowNull: false },
            contributions: { type: DataTypes.INTEGER(11), allowNull: false },
            milestones: { type: DataTypes.INTEGER(11), allowNull: false },
            views: { type: DataTypes.INTEGER(11), allowNull: false }
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'goal_stats'
        }
    );
    return goal_stats;
};


/*
    DROP TABLE IF EXISTS `goal_stats`;
    CREATE TABLE `goal_stats` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `goal_id` int(11) DEFAULT NULL,
    `followers` int(11) DEFAULT NULL,
    `links` int(11) DEFAULT NULL,
    `links_forward` int(11) DEFAULT NULL,
    `links_backward` int(11) DEFAULT NULL,
    `motivations` int(11) DEFAULT NULL,
    `contributions` int(11) DEFAULT NULL,
    `milestones` int(11) DEFAULT NULL,
    `views` int(11) DEFAULT NULL,
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;
*/
