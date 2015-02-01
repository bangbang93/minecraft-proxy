/**
 * Created by bangbang on 15/02/01.
 */
module.exports = function (version){
    switch(version.trim()){
        case '1.7.1-pre':case '1.7.2':case '1.7.3-pre':case '1.7.4':case '1.7.5':
            return 4;
        case '1.7.6':case '1.7.7':case '1.7.8':case '1.7.9':case '1.7.10':
            return 5;
        case '1.8':case '1.8.1':default:
            return 47;
    }
};