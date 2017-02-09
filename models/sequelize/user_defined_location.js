
//mapping database table user_defined_location

module.exports = function (sequelize, DataTypes) {

    var user_defined_location = sequelize.define(
        'user_defined_location',
        {
            //mapping coulumns i-e datatypes, null checks etc
            id: {type: DataTypes.INTEGER(11), allowNull: false, primaryKey: true, autoIncrement : true},
            street_number: {type: DataTypes.STRING, allowNull: true},
            route:{type:DataTypes.TEXT,allowNull:true},
            locality: {type:DataTypes.TEXT,allowNull:true},
            administrative_area_level_1:{type: DataTypes.STRING, allowNull: true},
            country: {type: DataTypes.STRING, allowNull: true},
            postal_code:{type: DataTypes.STRING, allowNull: true},
            formatted_address:{type:DataTypes.TEXT,allowNull:true},
            status: {type: DataTypes.ENUM('ACTIVE', 'DELETED'), allowNull: true},
            created: {type: DataTypes.INTEGER(11), allowNull: true},
            latitude: {type: DataTypes.DECIMAL(10,8), allowNull: true},
            longitude: {type: DataTypes.DECIMAL(11,8), allowNull: true}
        },
        {
            timestamps: false,
            paranoid: true,
            freezeTableName: true,

            // define the table's name
            tableName: 'user_defined_location'
        }
    );
    return user_defined_location;
}