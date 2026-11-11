// The two Q-version faces, cut into layers (assets/duo/*.png, made from assets/masters/her.png and him.png by tools/duo_extract.py).
// Every layer sits in a 512 x 512 box: [x, y, width, height]. `base` is the whole face (transparent outside the round face) with the moving
// parts painted out of it; the parts are put back on top of it, so with nothing moving it looks exactly like the picture.
export const DUO_SIZE = 512;
export const DUO_PARTS = {
  her: {
    browL: [82, 141, 103, 51],
    browR: [283, 171, 100, 34],
    mouth: [246, 331, 64, 37],
    lidL: [108, 237, 93, 39],
    eyeL: [106, 245, 97, 67],
    lidR: [307, 229, 92, 37],
    eyeR: [306, 235, 94, 70],
    pupilL: [152, 247, 49, 58],
    pupilR: [349, 239, 51, 60],
  },
  him: {
    browL: [87, 157, 126, 45],
    browR: [295, 156, 128, 46],
    mouth: [159, 327, 190, 38],
    lidL: [91, 239, 119, 15],
    eyeL: [91, 240, 120, 63],
    lidR: [300, 240, 119, 14],
    eyeR: [304, 240, 115, 63],
    pupilL: [132, 250, 61, 46],
    pupilR: [318, 250, 61, 46],
  },
};
