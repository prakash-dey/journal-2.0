// Global vars
let global_master_json_restructured;
let table_headers_options_arr = [
  "Date",
  "No of trades",
  "Time",
  "Instrument",
  "Order type",
  "Buy Quant.",
  "Buy Price",
  "Real. Quant.",
  "Sell Price",
  "Unreal. Quant.",
  "Adj Buy Avg",
  "Net amount",
  "P/L",
  "Day P/L",
];

(function init() {
  const dropdown_btn = document.querySelector("#environment");
  dropdown_btn.style.backgroundColor =
    dropdown_btn.value == "testing" ? "red" : "green";
})();

/******Convert CSV to JSON ***********/
function csvToJson(csvString) {
  const rows = csvString.split("\n");
  const headers = rows[0].split(",");
  const jsonData = [];
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i].split(",");
    if (values.length === headers.length) {
      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        const key = headers[j].trim().replace(/[\"]/g, "");
        const value = values[j].trim().replace(/[\"]/g, "");
        obj[key] = value;
      }
      jsonData.push(obj);
    }
  }
  return jsonData;
}

/*************File safety function ************/
function file_safety_func(master_json, child_json) {
//   console.log(master_json);
//   if (!master_json) {
//     window.confirm("Do you want to proceed without master file");
//   }
}

/****************Restructure the JSON file ***********/
function restructure_json_func(json_data) {
  let restructured_json = {},
    helper_obj = {};

  // Grouping trades by execution time and symbol
  let grouped_data = json_data.reduce((group, trade) => {
    let key = `${trade["order_execution_time"]}-${trade["symbol"]}`;
    if (!group[key]) {
      group[key] = [];
    }
    group[key].push(trade);
    return group;
  }, {});

  console.log("grouped data",grouped_data);

  // Process grouped trades
  Object.values(grouped_data).forEach((grouped_trades) => {
    let first_trade = grouped_trades[0]; // Use the first trade for base information
    let total_quantity = 0;
    let total_price = 0;

    grouped_trades.forEach((trade) => {
      let trade_quantity = Number(trade["quantity"]);
      let trade_price = Number(trade["price"]);
      total_quantity += trade_quantity;
      total_price += trade_quantity * trade_price; // Weighted sum
    });

    let avg_price = (total_price / total_quantity).toFixed(2); // Weighted average price

    // Create combined trade object
    let parse_info_obj = {
      status: first_trade["Status"] ?? "COMPLETE",
      time:
        first_trade["Time"] ??
        first_trade["order_execution_time"].replace("T", " "),
      instrument: first_trade["Instrument"] ?? first_trade["symbol"],
      order_type:
        first_trade["Type"] ?? first_trade["trade_type"].toUpperCase(),
      avg_price: avg_price,
      quantity: total_quantity,
    };

    let obj = {
      time: "--",
      instrument: "--",
      order_type: "",
      buy_quantity: "--",
      buy_price: "--",
      realized_quantity: "--",
      sell_price: "--",
      unrealized_quantity: "--",
      adjusted_buying_avg: "--",
      outstanding_amt: 0,
      profit_or_loss: "--",
    };

    if (parse_info_obj.status == "COMPLETE") {
      obj.instrument = parse_info_obj.instrument.trim();
      let date = parse_info_obj.time.trim();
      obj.time = date.split(" ")[1];
      obj.order_type = parse_info_obj.order_type.trim();

      if (!helper_obj[obj.instrument]) {
        helper_obj[obj.instrument] = {
          unrealized_quantity: 0,
          adjusted_buying_avg: 0,
        };
      }
      date = date.split(" ")[0];
      if (!restructured_json[date]) {
        restructured_json[date] = { trades: [], day_p_l: 0, length: 0 };
      }

      if (parse_info_obj.order_type == "BUY") {
        obj.buy_quantity = total_quantity;
        obj.buy_price = Number(parse_info_obj.avg_price);

        helper_obj[obj.instrument].adjusted_buying_avg =
          (helper_obj[obj.instrument].adjusted_buying_avg *
            helper_obj[obj.instrument].unrealized_quantity +
            obj.buy_quantity * obj.buy_price) /
          (helper_obj[obj.instrument].unrealized_quantity + obj.buy_quantity);
        obj.adjusted_buying_avg = Number(
          helper_obj[obj.instrument].adjusted_buying_avg.toFixed(2)
        );

        helper_obj[obj.instrument].unrealized_quantity += obj.buy_quantity;
        obj.unrealized_quantity =
          helper_obj[obj.instrument].unrealized_quantity;
      } else if (parse_info_obj.order_type == "SELL") {
        obj.realized_quantity = total_quantity;
        obj.sell_price = Number(parse_info_obj.avg_price);
        helper_obj[obj.instrument].unrealized_quantity -= obj.realized_quantity;
        obj.unrealized_quantity =
          helper_obj[obj.instrument].unrealized_quantity;
        obj.profit_or_loss =
          obj.realized_quantity * obj.sell_price -
          helper_obj[obj.instrument].adjusted_buying_avg *
            obj.realized_quantity;
        obj.profit_or_loss = Number(obj.profit_or_loss.toFixed(2));
        restructured_json[date].day_p_l += obj.profit_or_loss;
        restructured_json[date].day_p_l = Number(
          restructured_json[date].day_p_l.toFixed(2)
        );
      }
      obj.outstanding_amt = Number(
        (
          helper_obj[obj.instrument].adjusted_buying_avg *
          obj.unrealized_quantity
        ).toFixed(2)
      );

      restructured_json[date].trades.push(obj);
      restructured_json[date].length = restructured_json[date].trades.length;
    }
  });

  const entries = Object.entries(restructured_json);

  // Sort the array based on the keys (dates)
  entries.sort((a, b) => new Date(b[0]) - new Date(a[0]));

  // Convert sorted array back to object (if needed)
  const sortedData = Object.fromEntries(entries);
  return sortedData;
}

/**************Append and download JSON data ***********/
function append_and_download_json(master_json, child_json) {
  master_json = master_json ?? [];
  if (
    !master_json.length &&
    !window.confirm("Do you want to proceed without master file")
  ) {
    return master_json;
  }
  if (child_json) {
    child_json = child_json[0].trade_id ? child_json : child_json.reverse();
    master_json = master_json.concat(child_json);

        // let el = document.createElement("a");
        // var data =
        //   "text/json;charset=utf-8," +
        //   encodeURIComponent(JSON.stringify(master_json));
        // const environment_type = document.querySelector("#environment").value;

        // let file_name = `${environment_type.toUpperCase()}_${
        //   master_json[0].Status ? "order_book" : "trade_book"
        // }_option_master_data.json`;
        // el.setAttribute("href", "data:" + data);
        // el.setAttribute("download", file_name);
        // document.body.appendChild(el);
        // el.click();
        // el.remove();
  }

  return master_json;
}

/**************Table and profit/loss display ***********/

/***********Generate header**************/
function generate_journal_header() {
    let table_header_ele = document.querySelector("thead");
    let table_header_th = "";
  
    // Add your existing headers + new column "Tally P/L"
    table_headers_options_arr.forEach((option) => {
      table_header_th += `<th scope="col">${option}</th>`;
    });
    table_header_th += `<th scope="col">Tally P/L</th>`; // New column for tallying P/L
    table_header_ele.innerHTML = table_header_th;
  }
  

/**********Generate body rows with tally P/L */
function generate_journal_rows(master_json_data) {
  let tbody = document.querySelector("tbody");
  tbody.innerHTML = ``;

  for (const _date in master_json_data) {
    let data = master_json_data[_date];
    let tally_pl = 0; // Initialize tally for the day

    data.trades.forEach((row_obj, index) => {
      let tbody_tr = document.createElement("tr");
      let tds = ``;

      if (index === 0) {
        tds += `<td rowspan=${data.length}>${_date}</td>`;
        tds += `<td rowspan=${data.length}>${data.length} trades</td>`;
      }

      // Populate the row with trade data
      for (const property in row_obj) {
        tds += `<td class=${property}>${row_obj[property]}</td>`;
      }

      // Calculate and display the running tally of P/L
      tally_pl += row_obj.profit_or_loss ? Number(row_obj.profit_or_loss) : 0;
      tds += `<td>${tally_pl.toFixed(2)}</td>`; // Display the cumulative P/L

      if (index === 0) {
        tds += `<td rowspan=${data.length}>${data.day_p_l}</td>`;
      }

      tbody_tr.innerHTML = tds;

      let row_class = row_obj.order_type;
      if (row_class === "SELL") {
        row_class = row_obj.profit_or_loss > 0 ? "profit" : "loss";
      }

      tbody_tr.setAttribute("class", row_class.toLowerCase());
      tbody.appendChild(tbody_tr);
    });
  }
}

function show_final_profit_and_loss(json_data) {
  let final_p_n_l = 0;
  for (const property in json_data) {
    final_p_n_l += json_data[property].day_p_l;
  }
  const p_n_l_ele = document.querySelector(".p_n_l_div");
  p_n_l_ele.textContent = final_p_n_l.toFixed(2);
  let color = "green";
  if (final_p_n_l <= 0) {
    color = "red";
  }
  p_n_l_ele.style.color = color;
}
/***********Read the existing database */
/**
 * Note : For now I will be manually uploading the JSON database and later I will automate the task
 */

/****** Read and convert csv file on upload */
const csv_file_ele = document.getElementById("csvFile");
let order_book_json;

csv_file_ele.addEventListener("change", function (e) {
  e.preventDefault();
  const file = csv_file_ele.files[0];
  const reader = new FileReader();
  reader.readAsText(file);
  reader.onload = function (e) {
    const data = e.target.result;
    order_book_json = csvToJson(data);
    console.log("order_book_json", order_book_json);
  };
});

/*****Read and convert json file on upload */

const json_file_ele = document.getElementById("jsonFile");
let master_json_data;

json_file_ele.addEventListener("change", function (e) {
  e.preventDefault();
  const file = json_file_ele.files[0];
  const reader = new FileReader();
  reader.readAsText(file);
  reader.onload = function (e) {
    const data = e.target.result;
    master_json_data = JSON.parse(data);
  };
});

/*****Generate the table and dowload the append master json */
const generate_button = document.querySelector("button");

generate_button.addEventListener("click", (e) => {
  e.preventDefault();
  if (!order_book_json && !master_json_data) alert("Please upload files");
  else {
    let json_data = append_and_download_json(master_json_data, order_book_json);
    master_json_data = null;
    order_book_json = null;
    if (json_data.length) {
      global_master_json_restructured = restructure_json_func(json_data);
      generate_journal_header();
      generate_journal_rows(global_master_json_restructured);
      show_final_profit_and_loss(global_master_json_restructured);
      console.log(
        "global_master_json_restructured",
        global_master_json_restructured
      );
    }
  }
});

/************Change environment button color on click */
const dropdown_btn = document.querySelector("#environment");
dropdown_btn.addEventListener("change", () => {
  dropdown_btn.style.backgroundColor =
    dropdown_btn.value == "testing" ? "red" : "green";
});
/***************************** */
