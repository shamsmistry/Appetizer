module.exports = function (sequelize,DataTypes) {
    var category_tags = sequelize.define(
        'category_tags',
        {
            id: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            category_id: {type: DataTypes.INTEGER(11), allowNull: false},
            tag_id: {type: DataTypes.INTEGER(11), allowNull: false},
            status: {type: DataTypes.ENUM('ACTIVE', 'INACTIVE'), allowNull: true},
            created: {type: DataTypes.INTEGER(11), allowNull: false},
            updated: {type: DataTypes.INTEGER(11), allowNull: true}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'category_tags'
        }
    );
    return category_tags;
};