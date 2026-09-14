package com.example.pawmily

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.AppCompatButton
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class InboxActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_inbox)
        ImmersiveMode.applyAfterContent(this)

        findViewById<View>(R.id.btnBack).setOnClickListener { finish() }
        findViewById<AppCompatButton>(R.id.btnMarkRead).setOnClickListener {
            InboxStore.markAllRead(this)
            render()
        }
        render()
    }

    override fun onResume() {
        super.onResume()
        render()
    }

    private fun render() {
        val list = findViewById<LinearLayout>(R.id.llInboxMessages)
        val empty = findViewById<TextView>(R.id.tvInboxEmpty)
        list.removeAllViews()
        val messages = InboxStore.list(this)
        empty.visibility = if (messages.isEmpty()) View.VISIBLE else View.GONE
        val fmt = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
        messages.forEach { msg ->
            val row = LayoutInflater.from(this).inflate(R.layout.item_inbox_message, list, false)
            row.findViewById<TextView>(R.id.tvInboxTitle).text = msg.title
            row.findViewById<TextView>(R.id.tvInboxBody).text = msg.body
            row.findViewById<TextView>(R.id.tvInboxWhen).text = fmt.format(Date(msg.createdAtMs))
            if (!msg.read) {
                row.findViewById<TextView>(R.id.tvInboxTitle).setTypeface(null, android.graphics.Typeface.BOLD)
            }
            list.addView(row)
        }
    }
}
