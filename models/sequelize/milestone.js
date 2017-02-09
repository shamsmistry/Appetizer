
module.exports = function (sequelize, DataTypes) {

    var milestone = sequelize.define(
        'milestone',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: {type: DataTypes.INTEGER(11), allowNull: false,autoIncrement: true,primaryKey: true},
            text: {type: DataTypes.TEXT, allowNull: false},
            status: {type: DataTypes.ENUM('ACTIVE', 'DELETED','COMPLETED','USERDEACTIVATED'), allowNull: false},
            goal_id: {type: DataTypes.INTEGER(11), allowNull: false},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            seq_number: {type: DataTypes.INTEGER(11), allowNull: false},

            created: {type: DataTypes.INTEGER(11), allowNull: false},
            updated: {type: DataTypes.INTEGER(11), allowNull: true},
            finished_at: {type: DataTypes.INTEGER(11), allowNull: true}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'milestone'
        }
    );
    return milestone;
};