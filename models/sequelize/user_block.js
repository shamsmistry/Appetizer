
module.exports = function (sequelize,DataTypes) {

    var user_block = sequelize.define(
        'user_block',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            blocked_uid: {type: DataTypes.INTEGER(11), allowNull: false},
            status: {type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'USERDEACTIVATED'), allowNull: true, defaultValue : 'ACTIVE'},
            created: {type: DataTypes.INTEGER(11), allowNull: false},
            updated: {type: DataTypes.INTEGER(11), allowNull: true},

        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'user_block',
            classMethods: {
                associate: function(models) {
                    user_block.belongsTo(models.users, { foreignKey: 'uid'} );
                }
            }
        }
    );
    return user_block;
};
