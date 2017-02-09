
module.exports = function (sequelize,DataTypes) {

    var suggested_users_ignored = sequelize.define(
        'suggested_users_ignored',
        {
            id: {type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true, autoIncrement: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            ignored_uid: {type: DataTypes.INTEGER(11), allowNull: false},
            created : {type: DataTypes.INTEGER(11), allowNull: false}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'suggested_users_ignored',
            classMethods: {
                associate: function(models) {
                    suggested_users_ignored.belongsTo(models.users, { foreignKey: 'uid'} );
                }
            }
        }

    );
    return suggested_users_ignored;
};

// CREATE TABLE suggested_users_ignored
// (
//     id INT PRIMARY KEY NOT NULL AUTO_INCREMENT,
//     uid INT NOT NULL,
//     ignored_uid INT NOT NULL,
//     created INT NOT NULL
// );
// CREATE INDEX suggested_users_ignored_uid_index ON suggested_users_ignored (uid);