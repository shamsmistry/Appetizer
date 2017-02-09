
module.exports = function (sequelize, DataTypes) {

    var tags = sequelize.define(
        'tags',
        {
            tag_id: {autoIncrement: true, type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true},
            tagname: {type: DataTypes.STRING(60), allowNull: false},
            isFeatured: { type: DataTypes.BOOLEAN, allowNull: true },
            isDisplayable: { type: DataTypes.BOOLEAN, allowNull: true },
            icon_class: {type: DataTypes.STRING(100), allowNull: false},
            default_color: { type: DataTypes.STRING(7), allowNull: true },
            description: { type: DataTypes.TEXT, allowNull: false },
            question: { type: DataTypes.STRING(255), allowNull: true },
            image_id: { type: DataTypes.INTEGER(11), allowNull: true },
            bannerImage_id: { type: DataTypes.INTEGER(11), allowNull: true },
            image: {type: DataTypes.VIRTUAL},
            banner: {type: DataTypes.VIRTUAL},
            action_text: { type: DataTypes.STRING(255), allowNull: true },
            status: {type: DataTypes.ENUM('ACTIVE', 'DEACTIVATE', 'DELETED'), allowNull: true},
            created: {type: DataTypes.INTEGER(11), allowNull: false},
            updated: {type: DataTypes.INTEGER(11), allowNull: true}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'tags',
            classMethods: {
                associate: function (models) {
                    tags.hasMany(models.goals_tags, {foreignKey: 'tag_id'});
                    tags.hasMany(models.user_interest_tags, {foreignKey: 'tag_id'});
                }
            }

        }
    );
    return tags;
};