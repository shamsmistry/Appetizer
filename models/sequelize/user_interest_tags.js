
module.exports = function (sequelize, DataTypes) {

    var user_interest_tags = sequelize.define(
        'user_interest_tags',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            uid: {type: DataTypes.INTEGER(11), allowNull: false},
            tag_id: {type: DataTypes.INTEGER(11), allowNull: false},
            status: {type: DataTypes.ENUM('ACTIVE', 'INACTIVE' ,'USERDEACTIVATED'), allowNull: false},
            created: {type: DataTypes.INTEGER(11), allowNull: false},
            updated: {type: DataTypes.INTEGER(11), allowNull: true},
            //Derived Attributes
            isMyInterest: {type: DataTypes.VIRTUAL}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'user_interest_tags',
            classMethods: {
                associate: function (models) {
                    user_interest_tags.belongsTo(models.goals_tags, {foreignKey: 'tag_id'});
                    user_interest_tags.belongsTo(models.tags, {foreignKey: 'tag_id'});
                }
            }
        }
    );
    return user_interest_tags;
};