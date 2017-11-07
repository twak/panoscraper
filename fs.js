var _entry = null ;

$(function() {
    $("#go").click(function() {
        ensureFolder(function() {

        $("#canvas").get()[0].toBlob(function(blob) {

            chrome.fileSystem.getWritableEntry(_entry, function(entry) {
                entry.getFile("woowooo", {
                    create: true
                }, function(entry) {
                    entry.createWriter(function(writer) {
                        //           writer.onwrite = function() {
                        //             writer.onwrite = null;
                        //             writer.truncate(writer.position);
                        //           };
                        writer.onwriteend = function(e) {
                            console.log('write complete');
                        }
                        ;
                        writer.write(blob);
                    });
                });
            });
        }, "image/png");
    })
})
})


function ensureFolder(fn) {
    if (!_entry) {
        chrome.fileSystem.chooseEntry({
            type: 'openDirectory'
        }, function(entry) {
            _entry = entry;
            fn();
        });
    }
    else
        fn();
}
//   chrome.fileSystem.restoreEntry("file:///home/twak/Desktop/test.foo", function(f) {
//     console.log ( f );
//   });
