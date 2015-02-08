/**
 * Created by bangbang on 15/02/09.
 */
module.exports = function (Proxy){
    console.log('测试插件加载成功');
    Proxy.on('ready', function (){
        console.log('准备就绪，该信息由插件输出');
    })
};