module.exports = function (sequelize, DataTypes) {
    var url = sequelize.define(
        'fetched_url',
        {
            id: {type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true, autoIncrement: true},
            url: {type: DataTypes.STRING, allowNull: true},
            scheme: {type: DataTypes.STRING, allowNull: true},
            host: {type: DataTypes.STRING, allowNull: true},
            rootUrl: {type: DataTypes.STRING, allowNull: true},
            title: {type: DataTypes.STRING, allowNull: true},
            links: {type: DataTypes.STRING, allowNull: true},
            author: {type: DataTypes.STRING, allowNull: true},
            keywords: {type: DataTypes.STRING, allowNull: true},
            charset: {type: DataTypes.STRING, allowNull: true},
            description: {type: DataTypes.STRING, allowNull: true},
            feeds: {type: DataTypes.STRING, allowNull: true},
            ogTitle: {type: DataTypes.STRING, allowNull: true},
            ogDescription: {type: DataTypes.STRING, allowNull: true},
            imageUrl: {type: DataTypes.STRING, allowNull: true},
            imagePath: {type: DataTypes.STRING, allowNull: true},
            imageName: {type: DataTypes.STRING, allowNull: true},
            imageExtension: {type: DataTypes.STRING, allowNull: true},
            imageThumbSize: {type: DataTypes.ENUM('SQUARE', 'XLARGE', 'LARGE', 'MEDIUM', 'SMALL'), allowNull: true},
            imageThumbWidth: {type: DataTypes.STRING, allowNull: true},
            imageThumbHeight: {type: DataTypes.STRING, allowNull: true},
            thumbPath: {type: DataTypes.STRING, allowNull: true},
            provider: { type: DataTypes.STRING, allowNull: true },
            status: { type: DataTypes.ENUM('ACTIVE', 'DELETED', 'DEACTIVATED'), allowNull: true },
            updated: {type: DataTypes.INTEGER(11), allowNull: true},
            created: {type: DataTypes.INTEGER(11), allowNull: true}
        },
        {
            getterMethods: {
                thumb: function() {
                    return (this.imageName != null) ? process.env.FILE_SERVER_URL + this.imagePath + this.id + '/thumb/' + this.imageThumbSize.toLowerCase() + '/' +  this.imageName + this.imageExtension : '';
                },
                image: function() {
                    if (this.thumb.length > 0)
                        return {medium: {source : this.thumb}};
                    else 
                        return {};
                },
            },
            timestamps: false,
            paranoid: true,
            freezeTableName: true,
            tableName: 'fetched_url_data'
        }
    );
    return url;
};