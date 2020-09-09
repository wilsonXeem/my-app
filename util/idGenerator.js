module.exports.generateHex = () => {
    const digits = [1,2,3,4,5,6,7,8,9,'a','b','c','d','e','f']

    let hexcode = "5"

    while(hexcode.length < 24) {
        hexcode += (Math.round(Math.random() * 15)).toString(16)
    }
    return hexcode
}
// var num = generateHex()
// console.log(num)