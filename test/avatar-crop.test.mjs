import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarCrop} from '../src/lib/avatar-crop.mjs';

test('square crop centers landscape and portrait photos and reaches all edges',()=>{
  assert.deepEqual(avatarCrop(1000,500,1,0,0),{side:500,sx:250,sy:0});
  assert.deepEqual(avatarCrop(500,1000,1,0,0),{side:500,sx:0,sy:250});
  assert.equal(avatarCrop(1000,500,1,-1,0).sx,0);
  assert.equal(avatarCrop(1000,500,1,1,0).sx,500);
  assert.equal(avatarCrop(500,1000,1,0,1).sy,500);
});
test('zoom and dragging never expose pixels outside any source aspect ratio',()=>{
  for(const [width,height] of [[1000,500],[500,1000],[256,256],[40,3000],[3000,40]])
    for(const zoom of [0,1,1.5,2,4,9])for(const x of [-10,-1,0,1,10])for(const y of [-10,-1,0,1,10]){
      const crop=avatarCrop(width,height,zoom,x,y);
      assert.ok(crop.side>0&&crop.sx>=0&&crop.sy>=0);
      assert.ok(crop.sx+crop.side<=width+1e-8&&crop.sy+crop.side<=height+1e-8);
    }
});
test('invalid image dimensions fail before drawing',()=>{
  assert.throws(()=>avatarCrop(0,500,1,0,0),/Ukuran/);
  assert.throws(()=>avatarCrop(500,500,NaN,0,0),/Ukuran/);
});
