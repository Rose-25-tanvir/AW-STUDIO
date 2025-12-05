

export const PROJECT_DATA = [{
  
    "main_screen": "root/logic/main/main.aw",
    "root": {
      "res": {
        "layout": {
          "activity_main.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<LinearLayout\n    xmlns:android=\"http://schemas.android.com/apk/res/android\"\n    android:id=\"@+id/main_container\"\n    android:layout_width=\"match_parent\"\n    android:layout_height=\"match_parent\"\n    android:orientation=\"vertical\"\n    android:padding=\"20dp\"\n    android:background=\"#f3f4f6\">\n\n    <TextView\n        android:id=\"@+id/header_text\"\n        android:layout_width=\"match_parent\"\n        android:layout_height=\"wrap_content\"\n        android:text=\"Main Screen\"\n        android:textSize=\"24sp\"\n        android:textColor=\"#111827\"\n        android:textStyle=\"bold\"\n        android:gravity=\"center\"\n        android:layout_marginBottom=\"20dp\" />\n\n    <EditText\n        android:id=\"@+id/input_field\"\n        android:layout_width=\"match_parent\"\n        android:layout_height=\"50dp\"\n        android:hint=\"Enter name to pass\"\n        android:padding=\"10dp\"\n        android:background=\"#ffffff\"\n        android:layout_marginBottom=\"10dp\" />\n\n    <Button\n        android:id=\"@+id/save_btn\"\n        android:layout_width=\"match_parent\"\n        android:layout_height=\"50dp\"\n        android:text=\"Next Screen\"\n        android:background=\"#3B82F6\"\n        android:textColor=\"#ffffff\"\n        android:textStyle=\"bold\" />\n\n</LinearLayout>",
          "item_card.xml": "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<LinearLayout xmlns:android=\"http://schemas.android.com/apk/res/android\"\n    android:id=\"@+id/card_root\"\n    android:layout_width=\"match_parent\"\n    android:layout_height=\"match_parent\"\n    android:padding=\"16dp\"\n    android:background=\"#ffffff\"\n    android:orientation=\"vertical\"\n    android:gravity=\"center\">\n    \n    <ImageView\n        android:id=\"@+id/card_icon\"\n        android:layout_width=\"80dp\"\n        android:layout_height=\"80dp\"\n        android:background=\"#eeeeee\"\n        android:layout_marginBottom=\"20dp\" />\n        \n    <TextView \n        android:id=\"@+id/card_title\"\n        android:layout_width=\"wrap_content\" \n        android:layout_height=\"wrap_content\"\n        android:text=\"Receiver Screen\" \n        android:textSize=\"20sp\"\n        android:textStyle=\"bold\" />\n        \n    <TextView \n        android:id=\"@+id/display_text\"\n        android:layout_width=\"wrap_content\" \n        android:layout_height=\"wrap_content\"\n        android:text=\"Waiting for data...\" \n        android:textSize=\"16sp\"\n        android:layout_marginTop=\"10dp\"\n        android:textColor=\"#3B82F6\" />\n        \n    <Button\n        android:id=\"@+id/fetch_btn\"\n        android:layout_width=\"match_parent\"\n        android:layout_height=\"50dp\"\n        android:text=\"Fetch Random User\"\n        android:background=\"#10b981\"\n        android:textColor=\"#ffffff\"\n        android:layout_marginTop=\"20dp\" />\n        \n</LinearLayout>"
        }
      },
      "logic": {
        "main": {
          "main.aw": "WELCOM IN AW\ntitel : hi,\nicon: \"https://absfriend.ct.ws/images/1.jpg\"\nTHE CODE IS START NOW\nui = root/res/layout/activity_main.xml\nnext_ui_path = root/logic/item/item.aw\n\n**/ Declare UI Elements /**\ntext = &&ui.header_text\nbtn = &&ui.save_btn\n\n**/ Event Listener /**\nfunc nav {} {\n  is.press.&&btn {\n    input = &&ui.input_field\n    intent.to.&&next_ui_path[&&input]\n  }\n}\n\nnav{}"
        },
        "item": {
          "item.aw": "WELCOM IN AW\nTHE CODE IS START NOW\nui = root/res/layout/item_card.xml\n\n**/ Receive Data /**\ndata = &&ui.intent.data[0]\ntext = &&ui.display_text.text[Received: &&data]\n\n**/ Network Request Example /**\nbtn = &&ui.fetch_btn\n\nis.press.&&btn {\n   toast{Fetching..., blue, 1}\n   \n   // Fetch JSON from API\n   response = http.get[https://randomuser.me/api/]\n   \n   // Parse JSON (path: results[0].email)\n   email = json.get[&&response, results.0.email]\n   pic = json.get[&&response, results.0.picture.large]\n   \n   // Update UI\n   text = &&ui.display_text.text[&&email]\n   image = &&ui.card_icon.image[&&pic]\n   \n   toast{Done!, green, 2}\n}\n"
        }
      }
    }

}];
