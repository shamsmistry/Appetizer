
module.exports = function (sequelize,DataTypes) {

    var featured_users = sequelize.define(
        'featured_users',
        {
            //mapping coulumns i-e datatypes, null checks etc
            _id: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: true},
            featured_by: {type: DataTypes.INTEGER(11), allowNull: true},
            description: {type: DataTypes.STRING(600), allowNull: true},
            status: {type: DataTypes.ENUM('ACTIVE','INACTIVE','USERDEACTIVATED'), allowNull: false},
            featured_date: {type: DataTypes.INTEGER(11), allowNull: true}
        },
        {
            timestamps: false,
            constraints: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'featured_users',
            classMethods: {
                associate: function(models) {
                    featured_users.hasOne(models.users, { foreignKey: 'uid'} );
                }
            }
        }
    );
    return featured_users;
};