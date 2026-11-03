// Test-only PNG decode through an independent QR implementation; never logs payloads.
import{createRequire}from'node:module';
import{BinaryBitmap,HybridBinarizer,RGBLuminanceSource,QRCodeReader}from'@zxing/library';
const require=createRequire(import.meta.url),qrRequire=createRequire(require.resolve('qrcode/package.json')),{PNG}=qrRequire('pngjs');
export function decodeTestQr(bytes){const image=PNG.sync.read(Buffer.from(bytes)),luma=new Uint8ClampedArray(image.width*image.height);for(let i=0;i<luma.length;i++){const p=i*4;luma[i]=(image.data[p]+2*image.data[p+1]+image.data[p+2])/4;}return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luma,image.width,image.height)))).getText();}
