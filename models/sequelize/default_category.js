
module.exports = function (sequelize, DataTypes) {

    var default_category = sequelize.define(
        'default_category',
        {
            //mapping coulumns i-e datatypes, null checks etc
            category_id: { autoIncrement: true, type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
            category_name: { type: DataTypes.STRING(100), allowNull: false },
            category_route: { type: DataTypes.STRING(100), allowNull: true },
            default_thumb: { type: DataTypes.STRING(200), allowNull: false },
            default_image_id: { type: DataTypes.INTEGER(11), allowNull: true },
            banner_id: { type: DataTypes.INTEGER(11), allowNull: true },
            default_color: { type: DataTypes.STRING(7), allowNull: false },
            default_icon: { type: DataTypes.STRING(100), allowNull: false },
            custom_message: { type: DataTypes.TEXT, allowNull: true },
            status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'DELETED'), allowNull: false },
            category_type: { type: DataTypes.BOOLEAN, allowNull: false },
            created: { type: DataTypes.INTEGER(11), allowNull: false },
            updated: { type: DataTypes.INTEGER(11), allowNull: true },
            default_color_class: { type: DataTypes.STRING(50), allowNull: false }
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'default_category'
        }
    );
    return default_category;
};