
    const doc_body = document.getElementById("qsl_area");
    const qsl_template = document.getElementById("qsl_template");

    const statusTextArea = document.getElementById("txt_status");

    const JACallSignRegex = /^(?<prefix>J[A-S]|7[J-N]|8[J-N])(?<area>\d)(?<suffix>[0-9A-Za-z]+)(?:\/(?<modifier>.+))?$/i;

    let qslImage = "";
    let adifStr = "";


    let cardCounter = 0;

    async function repaint() {
        for (let i = 0; i < 2; i++) {
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
    };

    // This idea for repainting is from 
    // https://qiita.com/kerupani129/items/3d26fef39e0e44101aad

    async function btn_adifFile_clicked (files){
        doc_body.innerHTML = "";
        cardCounter = 0;
        statusTextArea.textContent = "Processing...";

        await repaint();

        if(files.length > 0){
            let readStatus;
            for(file of Array.from(files)){
                await new Promise(
                    (resolve, reject) => {
                        readFile(
                                file, 
                                s => {adifStr = s || ""; readStatus=true; resolve();},
                                () => {adifStr = ""; readStatus = false; reject();}
                            )
                        }
                    )
                
                if(readStatus){
                    try {
                        await makeQSLData(parse_adi(adifStr));         
                    } catch (error) {
                        statusTextArea.textContent = "FILE ERROR!";            
                    }
                    statusTextArea.textContent = cardCounter + " QSL card" + (cardCounter > 1 ? "s have" : " has") + " been produced."
                }
                else{
                    statusTextArea.textContent = "FILE ERROR!";
                }
            }
        }
        else{
            statusTextArea.innerText = "Choose an ADIF file."
        }

        await repaint();
    }

    async function btn_imgFile_clicked(files){
        await repaint();
        if(files.length > 0){

            let readStatus;
            for(file of Array.from(files)){
                await new Promise(
                    (resolve, reject) => {
                        readImage(
                                file, 
                                s => {qslImage = s || ""; readStatus=true; resolve();},
                                () => {qslImage = ""; readStatus = false; reject();}
                            )
                        }
                    )
                
                document.querySelectorAll("img.qslImage").forEach(
                        elm => elm.setAttribute("src", qslImage)
                    );
            }
        }
        else{
            qslImage = "";
        }
        await repaint();

    }



    function readFile(file, callback_success={}, callback_fail={}){

        let file_reader = new FileReader();


        file_reader.onload = function(event){
            callback_success(event.target.result);
        };

        file_reader.onerror = function(event){
            callback_fail();
        };

        file_reader.readAsText(file);
        
    }


    function readImage(file, callback_success, callback_fail){
        let file_reader = new FileReader();

        file_reader.onload = function(event){
            callback_success(event.target.result);
        };

        file_reader.onerror = function(event){
            callback_fail();
        };

        file_reader.readAsDataURL(file);
    }


    function parse_adi(adifStr){
        let ap = new AdifParser(adifStr);
        return ap.parseTopLevel();
    }


    const qslRemarksBox = document.querySelector("#txt_remarks");

    const orderByJARLRuleChkBox = document.getElementById("chk_orderdByJARLRule"); 
    const useJSTChkBox = document.getElementById("chk_useJSTForJA");
    const useDotBorderBoxChkBox = document.querySelector("#chk_useDotBordered");

    const maxQSOsRowBox = document.getElementById("num_maxRows");
    const maxQSOsRowDefault = 10;
    
    const displayOPChkBox = document.querySelector("#chk_displayOP");
    const defaultOPBox = document.getElementById("txt_opDefault");

    const displayDEChkBox = document.querySelector("#chk_displayDE");
    const defaultDEBox = document.getElementById("txt_deDefault");

    async function makeQSLData(adifObj){
        // ADIF records
        const records = adifObj?.records;

        // Get the list of "callsign" value to obtain unique callsign list
        const callList = Array.from(new Set(records?.map(elm => elm.call).sort())).filter(call => (call.trim() !== ""));

        if(!callList){return;}
        
        let qslData = 
            callList.map(
                callSign => ({
                    "callSign": callSign,
                    "JARLBureauOrderKey": JARLBureauOrderKey(callSign),
                    "qsoData": records.filter(
                            elm => (elm.call === callSign)
                        )
                })
        );

        if(orderByJARLRuleChkBox.checked){
            qslData.sort(
                    (d1,d2) => 
                            (d1.JARLBureauOrderKey > d2.JARLBureauOrderKey) ? 1 : -1
                );
        } 

        await qslData.forEach(datum => printQSL(datum));

        /*
        // To paint every card during processing, use this code (but very slow)
        for(datum of qslData){
            await printQSL(datum); 
            await repaint();
        }
        */
    }

    // datum is like  {callSign: "***", qsoData: [...], JARLBureauOrderKey="***"}
    async function printQSL(datum){
        cardCounter++;

        const safeCallSign = datum.callSign?.replace("/","-");

        const isJA = JACallSignRegex.test(datum.callSign);

        const qslID = cardCounter + "_" + safeCallSign

        // Create a page / 1ページ作る
        const qsl_page = qsl_template.cloneNode(true);
        qsl_page.id = "qsl_" +  qslID;
        

        // Place the page / ページを設置
        doc_body.appendChild(qsl_page);

        // Change id for elements / IDを変更
        qsl_page.querySelectorAll("*").forEach(item => {
            if(item.id){
                item.id = item.id.replace("template", qslID);
            }

            if(item.getAttribute("for")){
                item.setAttribute("for", item.getAttribute("for").replace("template", qslID));
            }
        });

        // Fill the "To Radio" / "To Radio" を記入
        const txt_to_radio = qsl_page.querySelector(".box_to_radio");

        txt_to_radio.appendChild(document.createTextNode(datum.callSign));
        

        // Fill the JARL Bureau Frame / 転送枠
        const callSignBoxes_for_bureau_wrapper = qsl_page.querySelector(".table_bureau_call");
        const callSignBoxes_for_bureau = callSignBoxes_for_bureau_wrapper.querySelectorAll("tbody td");
        
        const callSignForBureau = JACallSignSplitter(datum.callSign);

        const isJARLStyleCheckbox = qsl_page.querySelector("#chk_JARLStyleFrame_" + qslID);
        isJARLStyleCheckbox.checked = isJA;

        const callSignTextBox = qsl_page.querySelector("#txt_qslto_callsign_" + qslID);
        callSignTextBox.value = callSignForBureau;

        qsl_page.querySelector("#chk_via_" + qslID).checked = false;
        
        qslTo_redraw(qsl_page.id);


        // Switch "QSO" or "QSOs"
        if(datum.qsoData.length > 1){
            qsl_page.querySelector(".statement").innerText += "s";
        }


        // Create a Table for QSO Data / 表を作る
        const data_table = qsl_page.querySelector(".table_qsoData");
        const table_id = data_table.id;


        // let timeZoneIndicator = document.querySelector("#" + table_id + " .tablecell_timezone");
        // timeZoneIndicator.appendChild(document.createTextNode((isJA && useJST) ? "(JST)" : "(UTC)"));
        let useJST = useJSTChkBox.checked;
        qsl_page.querySelector(".qsoHeader_time").innerHTML += "<br>" + ((isJA && useJST) ? "(JST)" : "(UTC)");

        let includeFreq = datum.qsoData.reduce((accum, qso) => (accum || !isNaN(qso.freq)), false);
        if(includeFreq){
            // document.querySelector("#" + table_id + " .tablecell_megaHertz").appendChild(document.createTextNode("(MHz)"));
            qsl_page.querySelector(".qsoHeader_freq").innerHTML = "FREQ<br>" + "(MHz)";
        }
        else{
            qsl_page.querySelector(".qsoHeader_freq").innerHTML = "BAND";           
        }
        

        const maxQSOsRowInt = Number.isNaN(maxQSOsRowBox.value) ? maxQSOsRowDefault : Number.parseInt(maxQSOsRowBox.value);


        // Fill the Table / 表に書き込む
        for(let j = 0; j < datum.qsoData.length; j++){

            if(j + 1 > maxQSOsRowInt){
                await printQSL(
                    {
                        callSign: datum.callSign,
                        qsoData: datum.qsoData.slice(maxQSOsRowInt)
                    }
                )
                break;
            }

            const qso = datum.qsoData[j];
            const tableRow = data_table.tBodies[0].insertRow(-1);

            let qsoDateTime = date_time_converter(qso.qso_date, qso.time_on || qso.time_off);

            qsoDateTime = (isJA && useJST) ? qsoDateTime.tz("Asia/Tokyo") : qsoDateTime;

            const dateCell = tableRow.insertCell(-1);
            dateCell.className = "qsoDatumCell qsoDatum_date";
            dateCell.appendChild(document.createTextNode(qsoDateTime.format("YYYY-MM-DD")));

            const timeCell = tableRow.insertCell(-1);
            timeCell.className = "qsoDatumCell qsoDatum_time";
            timeCell.appendChild(document.createTextNode(qsoDateTime.format("HH:mm")));

            const bandCell = tableRow.insertCell(-1);
            bandCell.className = "qsoDatumCell qsoDatum_band";
            bandCell.appendChild(document.createTextNode( !isNaN(qso.freq) ? parseFloat(qso.freq).toPrecision(4) : qso.band));

            const modeCell = tableRow.insertCell(-1);
            modeCell.className = "qsoDatumCell qsoDatum_mode";
            modeCell.appendChild(document.createTextNode(qso.mode));

            const reportCell = tableRow.insertCell(-1);
            reportCell.className = "qsoDatumCell qsoDatum_report";
            reportCell.appendChild(document.createTextNode(qso.rst_sent));

            const opCell = tableRow.insertCell(-1);
            const defaultOP = defaultOPBox.value;
            opCell.className = "qsoDatumCell qsoDatum_op";
            opCell.appendChild(document.createTextNode(qso.operator || defaultOP || ""));

            const deCell = tableRow.insertCell(-1);
            const defaultDE = defaultDEBox.value;
            deCell.className = "qsoDatumCell qsoDatum_de";
            deCell.appendChild(document.createTextNode(qso.station_callsign || defaultDE || ""));

            const qslMessage 
                = (qso.qslmsgintl ? qso.qslmsgintl + "; " : "") 
                + (qso.qslmsg ? qso.qslmsg + "; " : "")
                + (qso.sat_name ? "via SAT: " + qso.sat_name + "; ": "")
                + (!isNaN(qso.freq_rx) ? "RX Freq: " + parseFloat(qso.freq_rx).toPrecision(4).toString() + " MHz; " :  
                        (qso.band_rx ? "RX Band: " + qso.band_rx +"; ": "")
                    );
                
            if(qslMessage.trim()!==""){
                let msgRow = data_table.tBodies[0].insertRow(-1);
                let msgCell = msgRow.insertCell(-1);
                msgCell.setAttribute("colspan", 7);
                msgCell.className="qslMsg";
                msgCell.appendChild(document.createTextNode("(" + qslMessage.trim() + ")"));
            }
        }                      

        const qslRemarks = qslRemarksBox.value;
        if(!qslImage && !qslRemarks){
            qsl_page.querySelectorAll(".info_area").forEach(
                    elm => elm.classList.add("hidden")
                )
        }
        else{

            qsl_page.querySelectorAll(".info_area").forEach(
                    elm => elm.classList.remove("hidden")
                )

            qsl_page.querySelectorAll(".info_area img.qslImage").forEach(
                elm => elm.setAttribute("src", qslImage)
            );

            qsl_page.querySelectorAll(".info_area .remarks").forEach(
                elm => {elm.innerHTML =  DOMPurify.sanitize(qslRemarks);}
            );          
        }

    }
    

    function date_time_converter(dateExp, timeExp = "0000"){
        if(dateExp?.length != 8 || (timeExp?.length != 4 && timeExp?.length != 6)){
            return null;
        }

        let dateMatch = dateExp.match(/^(?<year>\d{4})(?<month>\d{2})(?<day>\d{2})$/);
        let timeMatch = timeExp.match(/^(?<hour>\d{2})(?<minute>\d{2})(?<second>\d{2})?$/);

        if(!dateMatch || !timeMatch){
            return null;
        }

        let ISOString = dateMatch.groups.year + "-"
            + dateMatch.groups.month + "-"
            + dateMatch.groups.day + "T"
            + timeMatch.groups.hour + ":"
            + timeMatch.groups.minute + ":"
            + (timeMatch.groups.second || "00")
            + "Z";

        return moment.utc(ISOString);
    }

    
    function JACallSignSplitter(callSign){
        let callSignParts = callSign?.split("/");
        
        let callSignLetters = [];

        switch (callSignParts.length) {
            case 0:
                return null;
                break;

            // case 1:
            // case 2:
                callSignLetters = callSignParts[0];
                break;
            
            default:
                callSignLetters = callSignParts.sort((a, b) => b.length - a.length)[0];
                break;
        }

        return callSignLetters;
    }

    function JARLBureauOrderKey(callSign){

        let resultKey = "";

        if(JACallSignRegex.test(callSign)){
            let callSignMatch = callSign.match(JACallSignRegex);
            switch(callSignMatch.groups.prefix[0]){
                case "J":
                    resultKey = "1" 
                            + ((parseInt(callSignMatch.groups.area) - 1 + 10)% 10 + 1).toString(16)
                            + callSignMatch.groups.prefix
                            + callSignMatch.groups.suffix.length
                            + callSignMatch.groups.suffix;
                    break;

                case "7":
                    resultKey = "7"
                            + callSignMatch.groups.prefix
                            + ((parseInt(callSignMatch.groups.area) - 1 + 10)% 10 + 1).toString(16)
                            + callSignMatch.groups.suffix;
                    break;

                case "8":
                    resultKey = "8"
                            + callSignMatch.groups.prefix
                            + ((parseInt(callSignMatch.groups.area) - 1 + 10)% 10 + 1).toString(16)
                            + callSignMatch.groups.suffix;
                    break;

                default:
                    resultKey = "0" + callSign
            }
        }
        else{
            resultKey = "0" + callSign
        }

        return resultKey;
    }

    function qslTo_redraw(sectionID){
        const qslPage = document.getElementById(sectionID);

        const viaCheckBox = qslPage.querySelector(".chk_via");
        const viaText = qslPage.querySelector(".txt_via")
        
        const isJARLStyleCheckBox = qslPage.querySelector(".chk_JARLStyleFrame");
        const JARLStyleCallsignBoxesWrapper =  qslPage.querySelector(".table_bureau_call");
        const JARLStyleCallsignBoxes = JARLStyleCallsignBoxesWrapper.querySelectorAll("tbody td");
        const DXCallsignBox = qslPage.querySelector(".qslTo_box");

        const qslToCallSignTextBox = qslPage.querySelector(".txt_qslto_callsign")

        if(viaCheckBox.checked){
            viaText.classList.remove("hidden");
        }
        else {
            viaText.classList.add("hidden");
        }



        if(isJARLStyleCheckBox.checked){
            JARLStyleCallsignBoxesWrapper.classList.remove("hidden");
            /*
            JARLStyleCallsignBoxes.forEach(
                b => {
                    b.classList.add(useDotBorderBox ? "dot_bordered" : "red_bordered");
                }
            )
            */
            DXCallsignBox.classList.add("hidden");
        }
        else{
            JARLStyleCallsignBoxesWrapper.classList.add("hidden");
            /*
            JARLStyleCallsignBoxes.forEach(
                b => {
                    b.classList.remove("red_bordered","dot_bordered");
                }
            )
            */
            DXCallsignBox.classList.remove("hidden");

        }

        if((!isJARLStyleCheckBox.checked) && viaCheckBox.checked){
            DXCallsignBox.classList.remove("hidden");
        }
        else{
            DXCallsignBox.classList.add("hidden");
        }

        for (let index = 0; index < JARLStyleCallsignBoxes.length; index++) {
                if(index < JARLStyleCallsignBoxes.length -1){
                    JARLStyleCallsignBoxes[index].innerText = qslToCallSignTextBox.value[index] || '';
                }
                else{
                    JARLStyleCallsignBoxes[index]
                    .innerText = qslToCallSignTextBox.value.slice(index) || '';
                    break;
                }
                
        }

        DXCallsignBox.innerText = qslToCallSignTextBox.value;

    }



    function switchOPField(){

        const opFields = document.querySelectorAll(".qsoDatum_op");
        const opHeaders = document.querySelectorAll(".qsoHeader_op");

        if(displayOPChkBox.checked){
            opFields.forEach(f => f.classList.remove("hidden"));
            opHeaders.forEach(f => f.classList.remove("hidden"));
        }
        else{
            opFields.forEach(f => f.classList.add("hidden"));
            opHeaders.forEach(f => f.classList.add("hidden"));
        }
    }

    function switchDEField(){

        const deFields = document.querySelectorAll(".qsoDatum_de");
        const deHeaders = document.querySelectorAll(".qsoHeader_de");


        if(displayDEChkBox.checked){
            deFields.forEach(f => f.classList.remove("hidden"));
            deHeaders.forEach(f => f.classList.remove("hidden"));
        }
        else{
            deFields.forEach(f => f.classList.add("hidden"));
            deHeaders.forEach(f => f.classList.add("hidden"));
        }
    }

    function switchCallSignBoxColor(){

        const callSignBoxes = document.querySelectorAll(".table_bureau_call td");
        
        let useDotBorderBox=useDotBorderBoxChkBox.checked;

        callSignBoxes.forEach(b => {
                    b.classList.remove(useDotBorderBox ? "red_bordered" : "dot_bordered");
                    b.classList.add(useDotBorderBox ? "dot_bordered" : "red_bordered")
            });


    }

    function cssSelector(value){

        const cardSizeCSSElm = document.getElementById("css-cardsize");
        let modified = new Date();
        let str = modified.toISOString();

        switch (value) {
            case "ja-card":
                cardSizeCSSElm.href="style-ja-card.css?t=" + str;
                break;
            
            case "intl-card":
                cardSizeCSSElm.href="style-intl-card.css?t=" + str;
                break;

            case "sticker":
                cardSizeCSSElm.href="style-sticker.css?t=" + str;
                break;

            case "sticker-a4l":
                cardSizeCSSElm.href="style-sticker-a4l.css?t=" + str;
                break;

            default:
                break;
        }
    }
